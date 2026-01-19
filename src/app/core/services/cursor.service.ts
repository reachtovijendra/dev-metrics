import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CredentialsService } from './credentials.service';
import {
  CursorTeamMember,
  CursorDailyUsageRequest,
  CursorDailyUsageResponse,
  CursorAggregatedMetrics
} from '../models/cursor.model';
import { CursorMetrics, DateRange } from '../models/developer.model';

@Injectable({
  providedIn: 'root'
})
export class CursorService {
  private http = inject(HttpClient);
  private credentialsService = inject(CredentialsService);

  private readonly baseUrl = 'https://api.cursor.com';

  private getAuthHeaders(): HttpHeaders {
    const creds = this.credentialsService.getCursorCredentials();
    if (!creds) {
      return new HttpHeaders();
    }
    const authToken = btoa(`${creds.apiKey}:`);
    return new HttpHeaders({
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json'
    });
  }

  getTeamMembers(): Observable<CursorTeamMember[]> {
    return this.http.get<{ members: CursorTeamMember[] }>(
      `${this.baseUrl}/teams/members`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.members || []),
      catchError(() => of([]))
    );
  }

  getDailyUsage(dateRange: DateRange): Observable<CursorDailyUsageResponse> {
    const request: CursorDailyUsageRequest = {
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString()
    };

    return this.http.post<CursorDailyUsageResponse>(
      `${this.baseUrl}/teams/daily-usage-data`,
      request,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(() => of({ data: [] }))
    );
  }

  getAggregatedMetrics(dateRange: DateRange): Observable<CursorAggregatedMetrics[]> {
    return this.getDailyUsage(dateRange).pipe(
      map(response => {
        const userMetricsMap = new Map<string, CursorAggregatedMetrics>();

        for (const dailyUsage of response.data) {
          const existing = userMetricsMap.get(dailyUsage.userId);
          const metrics = dailyUsage.metrics;

          if (existing) {
            existing.totalLinesGenerated += metrics.totalLinesAdded;
            existing.acceptedLinesAdded += metrics.acceptedLinesAdded;
            existing.totalTabsShown += metrics.totalTabsShown;
            existing.totalTabsAccepted += metrics.totalTabsAccepted;
            existing.totalRequests += metrics.totalComposerRequests + metrics.totalChatRequests + metrics.totalAgentRequests;
            existing.spendingUsd += metrics.usageBasedRequests * 0.01; // Estimated cost per request
            existing.activeDays += 1;
          } else {
            userMetricsMap.set(dailyUsage.userId, {
              userId: dailyUsage.userId,
              email: dailyUsage.email,
              name: dailyUsage.name,
              totalLinesGenerated: metrics.totalLinesAdded,
              acceptedLinesAdded: metrics.acceptedLinesAdded,
              totalTabsShown: metrics.totalTabsShown,
              totalTabsAccepted: metrics.totalTabsAccepted,
              tabAcceptanceRate: 0, // Calculate after aggregation
              totalRequests: metrics.totalComposerRequests + metrics.totalChatRequests + metrics.totalAgentRequests,
              spendingUsd: metrics.usageBasedRequests * 0.01,
              activeDays: 1
            });
          }
        }

        // Calculate acceptance rates
        return Array.from(userMetricsMap.values()).map(m => ({
          ...m,
          tabAcceptanceRate: m.totalTabsShown > 0 
            ? Math.round((m.totalTabsAccepted / m.totalTabsShown) * 100) 
            : 0
        }));
      })
    );
  }

  getDeveloperMetrics(email: string, dateRange: DateRange): Observable<CursorMetrics> {
    return this.getAggregatedMetrics(dateRange).pipe(
      map(allMetrics => {
        const userMetrics = allMetrics.find(m => 
          m.email.toLowerCase() === email.toLowerCase()
        );

        if (!userMetrics) {
          return this.emptyMetrics();
        }

        return {
          totalLinesGenerated: userMetrics.totalLinesGenerated,
          acceptedLinesAdded: userMetrics.acceptedLinesAdded,
          totalTabsShown: userMetrics.totalTabsShown,
          totalTabsAccepted: userMetrics.totalTabsAccepted,
          tabAcceptanceRate: userMetrics.tabAcceptanceRate,
          totalRequests: userMetrics.totalRequests,
          spendingUsd: userMetrics.spendingUsd,
          activeDays: userMetrics.activeDays
        };
      })
    );
  }

  private emptyMetrics(): CursorMetrics {
    return {
      totalLinesGenerated: 0,
      acceptedLinesAdded: 0,
      totalTabsShown: 0,
      totalTabsAccepted: 0,
      tabAcceptanceRate: 0,
      totalRequests: 0,
      spendingUsd: 0,
      activeDays: 0
    };
  }

  testConnection(): Observable<boolean> {
    return this.getTeamMembers().pipe(
      map(members => members.length >= 0),
      catchError(() => of(false))
    );
  }
}


