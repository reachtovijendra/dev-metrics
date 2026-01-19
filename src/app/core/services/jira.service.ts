import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { CredentialsService } from './credentials.service';
import {
  JiraSearchResponse,
  JiraIssue,
  JiraUser,
  JiraAggregatedMetrics
} from '../models/jira.model';
import { JiraMetrics, DateRange } from '../models/developer.model';

@Injectable({
  providedIn: 'root'
})
export class JiraService {
  private http = inject(HttpClient);
  private credentialsService = inject(CredentialsService);

  private get baseUrl(): string {
    // Use proxy path for development to avoid CORS issues
    // The proxy.conf.json forwards /jira-api to the actual server
    return '/jira-api';
  }

  private getAuthHeaders(): HttpHeaders {
    const creds = this.credentialsService.getJiraCredentials();
    if (!creds) {
      return new HttpHeaders();
    }
    const authToken = btoa(`${creds.email}:${creds.apiToken}`);
    return new HttpHeaders({
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json'
    });
  }

  searchIssues(jql: string, maxResults: number = 100, startAt: number = 0): Observable<JiraSearchResponse> {
    const params = new HttpParams()
      .set('jql', jql)
      .set('maxResults', maxResults.toString())
      .set('startAt', startAt.toString())
      .set('fields', 'summary,status,issuetype,assignee,reporter,created,updated,resolutiondate,resolution,priority');

    return this.http.get<JiraSearchResponse>(
      `${this.baseUrl}/search`,
      { headers: this.getAuthHeaders(), params }
    ).pipe(
      catchError(() => of({ expand: '', startAt: 0, maxResults: 0, total: 0, issues: [] }))
    );
  }

  getAllIssuesForJql(jql: string): Observable<JiraIssue[]> {
    return this.searchIssues(jql, 100, 0).pipe(
      switchMap(firstPage => {
        if (firstPage.total <= 100) {
          return of(firstPage.issues);
        }

        const additionalRequests: Observable<JiraSearchResponse>[] = [];
        for (let start = 100; start < firstPage.total && start < 1000; start += 100) {
          additionalRequests.push(this.searchIssues(jql, 100, start));
        }

        return forkJoin([of(firstPage), ...additionalRequests]).pipe(
          map(responses => responses.flatMap(r => r.issues))
        );
      })
    );
  }

  getIssueCount(jql: string): Observable<number> {
    return this.searchIssues(jql, 0, 0).pipe(
      map(response => response.total)
    );
  }

  getCurrentUser(): Observable<JiraUser | null> {
    return this.http.get<JiraUser>(
      `${this.baseUrl}/myself`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(() => of(null))
    );
  }

  getDeveloperMetrics(accountId: string, dateRange: DateRange): Observable<JiraMetrics> {
    const startDate = dateRange.startDate.toISOString().split('T')[0];
    const endDate = dateRange.endDate.toISOString().split('T')[0];

    // JQL queries for different metrics
    const ticketsDevDoneJql = `assignee = "${accountId}" AND status changed to "Done" DURING ("${startDate}", "${endDate}")`;
    const ticketsQaDoneJql = `assignee = "${accountId}" AND status changed to "QA Done" DURING ("${startDate}", "${endDate}")`;
    const defectsInjectedJql = `issuetype = Bug AND reporter = "${accountId}" AND created >= "${startDate}" AND created <= "${endDate}"`;
    const defectsFixedJql = `issuetype = Bug AND assignee = "${accountId}" AND resolved >= "${startDate}" AND resolved <= "${endDate}"`;
    const totalAssignedJql = `assignee = "${accountId}" AND created >= "${startDate}" AND created <= "${endDate}"`;
    const inProgressJql = `assignee = "${accountId}" AND status = "In Progress"`;
    const blockedJql = `assignee = "${accountId}" AND (status = "Blocked" OR labels = blocked)`;

    return forkJoin({
      ticketsDevDone: this.getIssueCount(ticketsDevDoneJql),
      ticketsQaDone: this.getIssueCount(ticketsQaDoneJql),
      defectsInjected: this.getIssueCount(defectsInjectedJql),
      defectsFixed: this.getIssueCount(defectsFixedJql),
      totalAssigned: this.getIssueCount(totalAssignedJql),
      inProgress: this.getIssueCount(inProgressJql),
      blocked: this.getIssueCount(blockedJql),
      resolvedIssues: this.getAllIssuesForJql(
        `assignee = "${accountId}" AND resolved >= "${startDate}" AND resolved <= "${endDate}"`
      )
    }).pipe(
      map(results => {
        // Calculate average resolution time
        let totalResolutionHours = 0;
        let resolvedCount = 0;
        
        for (const issue of results.resolvedIssues) {
          if (issue.fields.created && issue.fields.resolutiondate) {
            const created = new Date(issue.fields.created).getTime();
            const resolved = new Date(issue.fields.resolutiondate).getTime();
            const hours = (resolved - created) / (1000 * 60 * 60);
            totalResolutionHours += hours;
            resolvedCount++;
          }
        }

        return {
          ticketsDevDone: results.ticketsDevDone,
          ticketsQaDone: results.ticketsQaDone,
          defectsInjected: results.defectsInjected,
          defectsFixed: results.defectsFixed,
          totalTicketsAssigned: results.totalAssigned,
          avgResolutionTimeHours: resolvedCount > 0 
            ? Math.round(totalResolutionHours / resolvedCount) 
            : 0,
          ticketsInProgress: results.inProgress,
          ticketsBlocked: results.blocked
        };
      }),
      catchError(() => of(this.emptyMetrics()))
    );
  }

  getAggregatedMetrics(dateRange: DateRange): Observable<JiraAggregatedMetrics[]> {
    const startDate = dateRange.startDate.toISOString().split('T')[0];
    const endDate = dateRange.endDate.toISOString().split('T')[0];

    // Get all resolved issues in the date range
    const jql = `resolved >= "${startDate}" AND resolved <= "${endDate}" ORDER BY assignee`;
    
    return this.getAllIssuesForJql(jql).pipe(
      map(issues => {
        const metricsMap = new Map<string, JiraAggregatedMetrics>();

        for (const issue of issues) {
          const assignee = issue.fields.assignee;
          if (!assignee) continue;

          const existing = metricsMap.get(assignee.accountId);
          const isBug = issue.fields.issuetype.name.toLowerCase().includes('bug');

          if (existing) {
            existing.ticketsDevDone++;
            if (isBug) existing.defectsFixed++;
          } else {
            metricsMap.set(assignee.accountId, {
              userId: assignee.accountId,
              displayName: assignee.displayName,
              email: assignee.emailAddress,
              ticketsDevDone: 1,
              ticketsQaDone: 0,
              defectsInjected: 0,
              defectsFixed: isBug ? 1 : 0,
              totalTicketsAssigned: 0,
              avgResolutionTimeHours: 0,
              ticketsInProgress: 0,
              ticketsBlocked: 0
            });
          }
        }

        return Array.from(metricsMap.values());
      })
    );
  }

  private emptyMetrics(): JiraMetrics {
    return {
      ticketsDevDone: 0,
      ticketsQaDone: 0,
      defectsInjected: 0,
      defectsFixed: 0,
      totalTicketsAssigned: 0,
      avgResolutionTimeHours: 0,
      ticketsInProgress: 0,
      ticketsBlocked: 0
    };
  }

  testConnection(): Observable<boolean> {
    return this.getCurrentUser().pipe(
      map(user => user !== null),
      catchError(() => of(false))
    );
  }
}

