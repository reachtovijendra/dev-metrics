import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, shareReplay, expand, takeWhile, reduce } from 'rxjs/operators';
import { CredentialsService } from './credentials.service';
import { EnvironmentService } from './environment.service';
import {
  MablTestRun,
  MablTestRunsResponse,
  MablApplication,
  MablApplicationsResponse,
  MablEnvironment,
  MablEnvironmentsResponse,
  MablActivityEntry,
  MablActivityResponse,
  MablAggregatedMetrics,
  MablDailyTrend,
  MablAccessibilityViolations,
  MablTestRunQuery
} from '../models/mabl.model';
import { DateRange } from '../models/developer.model';

const CACHE_KEY_PREFIX = 'dev-metrics-mabl-';
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface CacheParams {
  startDate: string;
  endDate: string;
  workspaceId: string;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
  params: CacheParams;
}

@Injectable({
  providedIn: 'root'
})
export class MablService {
  private http = inject(HttpClient);
  private credentialsService = inject(CredentialsService);
  private environmentService = inject(EnvironmentService);

  private applicationsCache$: Observable<MablApplication[]> | null = null;
  private environmentsCache$: Observable<MablEnvironment[]> | null = null;

  private get baseUrl(): string {
    return this.environmentService.getMablApiUrl();
  }

  private getAuthHeaders(): HttpHeaders {
    const creds = this.credentialsService.getMablCredentials();
    if (!creds) {
      console.error('MABL: No credentials found');
      return new HttpHeaders();
    }
    
    // MABL expects Basic auth with format: key:API_KEY
    const authString = btoa(`key:${creds.apiKey}`);
    
    // Debug: Log partial key for verification (first 8 chars only)
    console.log('MABL: Using API key starting with:', creds.apiKey.substring(0, 8) + '...');
    console.log('MABL: Auth header (partial):', `Basic ${authString.substring(0, 20)}...`);
    
    return new HttpHeaders()
      .set('Authorization', `Basic ${authString}`)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json');
  }

  private getWorkspaceId(): string {
    const creds = this.credentialsService.getMablCredentials();
    return creds?.workspaceId || '';
  }

  getApplications(forceRefresh: boolean = false): Observable<MablApplication[]> {
    if (!forceRefresh && this.applicationsCache$) {
      return this.applicationsCache$;
    }

    const workspaceId = this.getWorkspaceId();
    if (!workspaceId) {
      console.warn('MABL: No workspace ID configured');
      return of([]);
    }

    const url = `${this.baseUrl}/applications`;
    console.log('MABL: Fetching applications from:', url);

    this.applicationsCache$ = this.http.get(url, { 
      headers: this.getAuthHeaders(),
      params: new HttpParams().set('workspace_id', workspaceId),
      observe: 'response',
      responseType: 'text'
    }).pipe(
      map(response => {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.error('MABL: Applications response is not JSON');
          return [];
        }
        try {
          const data = JSON.parse(response.body || '{}') as MablApplicationsResponse;
          console.log('MABL: Found', data.applications?.length || 0, 'applications');
          return data.applications || [];
        } catch (e) {
          console.error('MABL: Failed to parse applications response:', e);
          return [];
        }
      }),
      shareReplay(1),
      catchError(err => {
        console.error('MABL: Error fetching applications:', err.status, err.statusText);
        this.applicationsCache$ = null;
        return of([]);
      })
    );

    return this.applicationsCache$;
  }

  getEnvironments(forceRefresh: boolean = false): Observable<MablEnvironment[]> {
    if (!forceRefresh && this.environmentsCache$) {
      return this.environmentsCache$;
    }

    const workspaceId = this.getWorkspaceId();
    if (!workspaceId) {
      console.warn('MABL: No workspace ID configured');
      return of([]);
    }

    const url = `${this.baseUrl}/environments`;
    console.log('MABL: Fetching environments from:', url);

    this.environmentsCache$ = this.http.get(url, { 
      headers: this.getAuthHeaders(),
      params: new HttpParams().set('workspace_id', workspaceId),
      observe: 'response',
      responseType: 'text'
    }).pipe(
      map(response => {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.error('MABL: Environments response is not JSON');
          return [];
        }
        try {
          const data = JSON.parse(response.body || '{}') as MablEnvironmentsResponse;
          console.log('MABL: Found', data.environments?.length || 0, 'environments');
          return data.environments || [];
        } catch (e) {
          console.error('MABL: Failed to parse environments response:', e);
          return [];
        }
      }),
      shareReplay(1),
      catchError(err => {
        console.error('MABL: Error fetching environments:', err.status, err.statusText);
        this.environmentsCache$ = null;
        return of([]);
      })
    );

    return this.environmentsCache$;
  }

  getTestRuns(
    dateRange: DateRange,
    options?: {
      applicationId?: string;
      environmentId?: string;
      testId?: string;
      planId?: string;
      advancedMetrics?: boolean;
    }
  ): Observable<MablTestRun[]> {
    const workspaceId = this.getWorkspaceId();
    if (!workspaceId) {
      return of([]);
    }

    let params = new HttpParams()
      .set('earliest_run_start_time', dateRange.startDate.getTime().toString())
      .set('latest_run_start_time', dateRange.endDate.getTime().toString());

    if (options?.applicationId) {
      params = params.set('application_id', options.applicationId);
    }
    if (options?.environmentId) {
      params = params.set('environment_id', options.environmentId);
    }
    if (options?.testId) {
      params = params.set('test_id', options.testId);
    }
    if (options?.planId) {
      params = params.set('plan_id', options.planId);
    }
    if (options?.advancedMetrics !== false) {
      params = params.set('advanced_metrics', 'true');
    }

    return this.fetchAllTestRuns(workspaceId, params);
  }

  private fetchAllTestRuns(workspaceId: string, baseParams: HttpParams): Observable<MablTestRun[]> {
    const fetchPage = (cursor?: string): Observable<MablTestRunsResponse> => {
      // workspace_id is in the URL path, not query params
      let params = baseParams.set('limit', '100');
      if (cursor) {
        params = params.set('cursor', cursor);
      }

      // Use the correct batch results endpoint: /results/workspace/{workspace_id}/testRuns
      const url = `${this.baseUrl}/results/workspace/${workspaceId}/testRuns`;
      console.log('MABL: Fetching test runs from:', url);

      return this.http.get(url, { 
        headers: this.getAuthHeaders(), 
        params,
        observe: 'response',
        responseType: 'text'
      }).pipe(
        map(response => {
          const contentType = response.headers.get('content-type') || '';
          console.log('MABL: Response content-type:', contentType);
          
          if (!contentType.includes('application/json')) {
            console.error('MABL: Response is not JSON. Body preview:', response.body?.substring(0, 500));
            return { test_results: [], cursor: undefined } as MablTestRunsResponse;
          }
          
          try {
            const data = JSON.parse(response.body || '{}');
            console.log('MABL: Response keys:', Object.keys(data));
            
            // Handle different possible response formats
            const testResults = data.test_results || data.executions || data.results || [];
            console.log('MABL: Found', testResults.length, 'test results');
            
            // Log first result structure for debugging
            if (testResults.length > 0) {
              const first = testResults[0];
              console.log('MABL: First test result keys:', Object.keys(first));
              console.log('MABL: First result - test_name:', first.test_name, 'journey_name:', first.journey_name, 'name:', first.name);
              console.log('MABL: First result - success:', first.success, 'status:', first.status);
              console.log('MABL: First result - run_time:', first.run_time, 'duration:', first.duration, 'duration_ms:', first.duration_ms);
              console.log('MABL: First result - start_time:', first.start_time, 'started_at:', first.started_at);
              console.log('MABL: First result - browser:', first.browser, 'browser_type:', first.browser_type);
              console.log('MABL: First result sample:', JSON.stringify(first).substring(0, 1000));
            }
            
            // Map fields using the shared mapping function
            const mappedResults = testResults.map((r: any) => this.mapTestResult(r));
            
            return {
              test_results: mappedResults,
              cursor: data.cursor,
              summary: data.summary
            } as MablTestRunsResponse;
          } catch (e) {
            console.error('MABL: Failed to parse JSON response:', e);
            return { test_results: [], cursor: undefined } as MablTestRunsResponse;
          }
        }),
        catchError(err => {
          console.error('MABL: Error fetching test runs:', err);
          console.error('MABL: Error status:', err.status);
          console.error('MABL: Error details:', err.error?.substring?.(0, 500) || err.error);
          return of({ test_results: [], cursor: undefined });
        })
      );
    };

    return fetchPage().pipe(
      expand(response => {
        if (response.cursor) {
          return fetchPage(response.cursor);
        }
        return of({ test_results: [], cursor: undefined });
      }),
      takeWhile(response => response.test_results.length > 0, true),
      reduce((acc: MablTestRun[], response) => [...acc, ...response.test_results], [])
    );
  }

  getActivityFeed(
    dateRange: DateRange,
    limit: number = 100
  ): Observable<MablActivityEntry[]> {
    const workspaceId = this.getWorkspaceId();
    if (!workspaceId) {
      return of([]);
    }

    const params = new HttpParams()
      .set('workspace_id', workspaceId)
      .set('limit', limit.toString());

    return this.http.get<MablActivityResponse>(
      `${this.baseUrl}/activity`,
      { headers: this.getAuthHeaders(), params }
    ).pipe(
      map(response => {
        const startTime = dateRange.startDate.getTime();
        const endTime = dateRange.endDate.getTime();
        return (response.activity_entries || []).filter(entry =>
          entry.created_time >= startTime && entry.created_time <= endTime
        );
      }),
      catchError(err => {
        console.error('Error fetching MABL activity feed:', err);
        return of([]);
      })
    );
  }

  getAggregatedMetrics(
    dateRange: DateRange,
    forceRefresh: boolean = false
  ): Observable<MablAggregatedMetrics> {
    const workspaceId = this.getWorkspaceId();
    if (!workspaceId) {
      return of(this.emptyAggregatedMetrics());
    }

    const cacheParams: CacheParams = {
      startDate: this.formatDateForCache(dateRange.startDate),
      endDate: this.formatDateForCache(dateRange.endDate),
      workspaceId
    };

    if (!forceRefresh) {
      const cached = this.getFromCache<MablAggregatedMetrics>('aggregated', cacheParams);
      if (cached) {
        console.log('Returning cached MABL metrics (age: ' +
          Math.round((Date.now() - cached.timestamp) / 1000) + 's)');
        return of(cached.data);
      }
    }

    return this.fetchTestRunsWithSummary(workspaceId, dateRange).pipe(
      map(result => {
        console.log('MABL: Building metrics from', result.testRuns.length, 'test runs');
        console.log('MABL: API summary:', result.summary);
        const metrics = this.calculateAggregatedMetrics(result.testRuns, dateRange, result.summary);
        this.saveToCache('aggregated', metrics, cacheParams);
        return metrics;
      })
    );
  }

  private fetchTestRunsWithSummary(
    workspaceId: string, 
    dateRange: DateRange
  ): Observable<{ testRuns: MablTestRun[]; summary: any }> {
    let params = new HttpParams()
      .set('earliest_run_start_time', dateRange.startDate.getTime().toString())
      .set('latest_run_start_time', dateRange.endDate.getTime().toString())
      .set('advanced_metrics', 'true')
      .set('limit', '100');

    const url = `${this.baseUrl}/results/workspace/${workspaceId}/testRuns`;
    
    const fetchPage = (cursor?: string, accumulated: MablTestRun[] = [], apiSummary?: any): Observable<{ testRuns: MablTestRun[]; summary: any }> => {
      let pageParams = params;
      if (cursor) {
        pageParams = params.set('cursor', cursor);
      }

      return this.http.get(url, {
        headers: this.getAuthHeaders(),
        params: pageParams,
        observe: 'response',
        responseType: 'text'
      }).pipe(
        switchMap(response => {
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            return of({ testRuns: accumulated, summary: apiSummary });
          }

          try {
            const data = JSON.parse(response.body || '{}');
            
            // Capture summary from first page response
            const summary = apiSummary || {
              number_of_runs: data.number_of_runs,
              number_of_successful_runs: data.number_of_successful_runs,
              number_of_failed_runs: data.number_of_failed_runs
            };

            const testResults = data.test_results || [];
            const mappedResults = testResults.map((r: any) => this.mapTestResult(r));
            const allResults = [...accumulated, ...mappedResults];

            if (data.cursor && testResults.length > 0) {
              return fetchPage(data.cursor, allResults, summary);
            }

            return of({ testRuns: allResults, summary });
          } catch (e) {
            console.error('MABL: Failed to parse response:', e);
            return of({ testRuns: accumulated, summary: apiSummary });
          }
        }),
        catchError(err => {
          console.error('MABL: Error fetching test runs:', err);
          return of({ testRuns: accumulated, summary: apiSummary });
        })
      );
    };

    return fetchPage();
  }

  private mapTestResult(r: any): MablTestRun {
    return {
      ...r,
      test_name: r.test_name || r.journey_name || r.name || 'Unknown Test',
      success: r.success ?? (r.status === 'succeeded' || r.status === 'passed'),
      run_time: r.run_time || r.duration || r.duration_ms || 0,
      start_time: r.start_time || r.started_at || r.created_time || Date.now(),
      browser: r.browser || r.browser_type || 'Unknown',
      application_name: r.application_name || r.app_name || 'Unknown App',
      environment_name: r.environment_name || r.env_name || 'Unknown Env',
      failure_category: r.failure_category || r.failure_reason || ''
    };
  }

  private calculateAggregatedMetrics(
    testRuns: MablTestRun[],
    dateRange: DateRange,
    apiSummary?: any
  ): MablAggregatedMetrics {
    // Use API summary if available, otherwise calculate from test runs
    const totalTestRuns = apiSummary?.number_of_runs ?? testRuns.length;
    const passedTests = apiSummary?.number_of_successful_runs ?? testRuns.filter(t => t.success).length;
    const failedTests = apiSummary?.number_of_failed_runs ?? (totalTestRuns - passedTests);
    const passRate = totalTestRuns > 0 ? (passedTests / totalTestRuns) * 100 : 0;
    const failRate = totalTestRuns > 0 ? (failedTests / totalTestRuns) * 100 : 0;
    
    console.log('MABL: Calculated metrics - total:', totalTestRuns, 'passed:', passedTests, 'failed:', failedTests);

    const totalRunTime = testRuns.reduce((sum, t) => sum + (t.run_time || 0), 0);
    const averageRunTime = totalTestRuns > 0 ? totalRunTime / totalTestRuns : 0;

    const testsByApplication: Record<string, number> = {};
    const testsByEnvironment: Record<string, number> = {};
    const testsByBrowser: Record<string, number> = {};
    const testsByStatus: Record<string, number> = {};
    const failureCategories: Record<string, number> = {};

    const accessibilityViolations: MablAccessibilityViolations = {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0
    };

    let totalSpeedIndex = 0;
    let speedIndexCount = 0;
    let totalApiResponseTime = 0;
    let apiResponseTimeCount = 0;

    for (const test of testRuns) {
      const appName = test.application_name || 'Unknown';
      testsByApplication[appName] = (testsByApplication[appName] || 0) + 1;

      const envName = test.environment_name || 'Unknown';
      testsByEnvironment[envName] = (testsByEnvironment[envName] || 0) + 1;

      const browser = test.browser || 'Unknown';
      testsByBrowser[browser] = (testsByBrowser[browser] || 0) + 1;

      const status = test.status || 'Unknown';
      testsByStatus[status] = (testsByStatus[status] || 0) + 1;

      if (!test.success && test.failure_category) {
        failureCategories[test.failure_category] = (failureCategories[test.failure_category] || 0) + 1;
      }

      if (test.metrics) {
        if (test.metrics.cumulative_speed_index) {
          totalSpeedIndex += test.metrics.cumulative_speed_index;
          speedIndexCount++;
        }
        if (test.metrics.cumulative_api_response_time) {
          totalApiResponseTime += test.metrics.cumulative_api_response_time;
          apiResponseTimeCount++;
        }
        if (test.metrics.accessibility_rule_violations) {
          accessibilityViolations.critical += test.metrics.accessibility_rule_violations.critical || 0;
          accessibilityViolations.serious += test.metrics.accessibility_rule_violations.serious || 0;
          accessibilityViolations.moderate += test.metrics.accessibility_rule_violations.moderate || 0;
          accessibilityViolations.minor += test.metrics.accessibility_rule_violations.minor || 0;
        }
      }
    }

    const dailyTrends = this.calculateDailyTrends(testRuns, dateRange);

    return {
      totalTestRuns,
      passedTests,
      failedTests,
      passRate,
      failRate,
      averageRunTime,
      totalRunTime,
      testsByApplication,
      testsByEnvironment,
      testsByBrowser,
      testsByStatus,
      failureCategories,
      accessibilityViolations,
      performanceMetrics: {
        avgSpeedIndex: speedIndexCount > 0 ? totalSpeedIndex / speedIndexCount : 0,
        avgApiResponseTime: apiResponseTimeCount > 0 ? totalApiResponseTime / apiResponseTimeCount : 0
      },
      dailyTrends
    };
  }

  private calculateDailyTrends(
    testRuns: MablTestRun[],
    dateRange: DateRange
  ): MablDailyTrend[] {
    const dailyMap = new Map<string, { total: number; passed: number; failed: number; runTime: number }>();

    for (const test of testRuns) {
      const date = new Date(test.start_time).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { total: 0, passed: 0, failed: 0, runTime: 0 };
      
      existing.total++;
      if (test.success) {
        existing.passed++;
      } else {
        existing.failed++;
      }
      existing.runTime += test.run_time || 0;
      
      dailyMap.set(date, existing);
    }

    const trends: MablDailyTrend[] = [];
    const currentDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const data = dailyMap.get(dateStr) || { total: 0, passed: 0, failed: 0, runTime: 0 };
      
      trends.push({
        date: dateStr,
        totalRuns: data.total,
        passed: data.passed,
        failed: data.failed,
        passRate: data.total > 0 ? (data.passed / data.total) * 100 : 0,
        avgRunTime: data.total > 0 ? data.runTime / data.total : 0
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return trends;
  }

  getTestsByPlan(dateRange: DateRange): Observable<Map<string, { name: string; total: number; passed: number; failed: number }>> {
    return this.getTestRuns(dateRange).pipe(
      map(testRuns => {
        const planMap = new Map<string, { name: string; total: number; passed: number; failed: number }>();

        for (const test of testRuns) {
          const planId = test.plan_id || 'no-plan';
          const existing = planMap.get(planId) || { name: test.plan_name || 'Ad-hoc Tests', total: 0, passed: 0, failed: 0 };
          
          existing.total++;
          if (test.success) {
            existing.passed++;
          } else {
            existing.failed++;
          }
          
          planMap.set(planId, existing);
        }

        return planMap;
      })
    );
  }

  getMostFailedTests(dateRange: DateRange, limit: number = 10): Observable<{ testId: string; testName: string; failureCount: number; totalRuns: number }[]> {
    return this.getTestRuns(dateRange).pipe(
      map(testRuns => {
        const testMap = new Map<string, { name: string; failures: number; total: number }>();

        for (const test of testRuns) {
          const testId = test.test_id;
          const existing = testMap.get(testId) || { name: test.test_name, failures: 0, total: 0 };
          
          existing.total++;
          if (!test.success) {
            existing.failures++;
          }
          
          testMap.set(testId, existing);
        }

        return Array.from(testMap.entries())
          .map(([testId, data]) => ({
            testId,
            testName: data.name,
            failureCount: data.failures,
            totalRuns: data.total
          }))
          .filter(t => t.failureCount > 0)
          .sort((a, b) => b.failureCount - a.failureCount)
          .slice(0, limit);
      })
    );
  }

  getFlakyTests(dateRange: DateRange, threshold: number = 0.3): Observable<{ testId: string; testName: string; flakinessScore: number; totalRuns: number }[]> {
    return this.getTestRuns(dateRange).pipe(
      map(testRuns => {
        const testMap = new Map<string, { name: string; results: boolean[] }>();

        for (const test of testRuns) {
          const testId = test.test_id;
          const existing = testMap.get(testId) || { name: test.test_name, results: [] };
          existing.results.push(test.success);
          testMap.set(testId, existing);
        }

        return Array.from(testMap.entries())
          .map(([testId, data]) => {
            const totalRuns = data.results.length;
            if (totalRuns < 3) return null;

            let transitions = 0;
            for (let i = 1; i < data.results.length; i++) {
              if (data.results[i] !== data.results[i - 1]) {
                transitions++;
              }
            }
            const flakinessScore = transitions / (totalRuns - 1);

            return {
              testId,
              testName: data.name,
              flakinessScore,
              totalRuns
            };
          })
          .filter((t): t is NonNullable<typeof t> => t !== null && t.flakinessScore >= threshold)
          .sort((a, b) => b.flakinessScore - a.flakinessScore);
      })
    );
  }

  testConnection(): Observable<boolean> {
    const workspaceId = this.getWorkspaceId();
    const creds = this.credentialsService.getMablCredentials();
    
    if (!workspaceId || !creds?.apiKey) {
      console.error('MABL: Missing workspace ID or API key');
      return of(false);
    }

    console.log('MABL: Testing connection to workspace:', workspaceId);
    
    // Use the correct reporting API endpoint: /results/workspace/{workspace_id}/testRuns
    const testUrl = `${this.baseUrl}/results/workspace/${workspaceId}/testRuns`;
    console.log('MABL: Testing connection with URL:', testUrl);
    
    // Just request 1 result to test connectivity
    const params = new HttpParams().set('limit', '1');
    
    return this.http.get(testUrl, { 
      headers: this.getAuthHeaders(),
      params,
      observe: 'response',
      responseType: 'text'
    }).pipe(
      map(response => {
        const contentType = response.headers.get('content-type') || '';
        console.log('MABL: Connection test response status:', response.status);
        
        if (contentType.includes('application/json')) {
          console.log('MABL: Connection successful!');
          return true;
        }
        console.error('MABL: Response is not JSON');
        return false;
      }),
      catchError(err => {
        console.error('MABL: Connection test failed');
        console.error('MABL: Error status:', err.status);
        console.error('MABL: Error:', err.error);
        return of(false);
      })
    );
  }

  private emptyAggregatedMetrics(): MablAggregatedMetrics {
    return {
      totalTestRuns: 0,
      passedTests: 0,
      failedTests: 0,
      passRate: 0,
      failRate: 0,
      averageRunTime: 0,
      totalRunTime: 0,
      testsByApplication: {},
      testsByEnvironment: {},
      testsByBrowser: {},
      testsByStatus: {},
      failureCategories: {},
      accessibilityViolations: { critical: 0, serious: 0, moderate: 0, minor: 0 },
      performanceMetrics: { avgSpeedIndex: 0, avgApiResponseTime: 0 },
      dailyTrends: []
    };
  }

  private formatDateForCache(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private generateCacheKey(type: string, params: CacheParams): string {
    const keyParts = [type, params.startDate, params.endDate, params.workspaceId];
    const keyString = keyParts.join('|');
    return CACHE_KEY_PREFIX + this.simpleHash(keyString);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getFromCache<T>(type: string, params: CacheParams): CachedData<T> | null {
    try {
      const cacheKey = this.generateCacheKey(type, params);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const parsed: CachedData<T> = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;

      if (age < CACHE_DURATION_MS) {
        return parsed;
      }

      localStorage.removeItem(cacheKey);
      return null;
    } catch {
      return null;
    }
  }

  private saveToCache<T>(type: string, data: T, params: CacheParams): void {
    try {
      const cacheKey = this.generateCacheKey(type, params);
      const cacheData: CachedData<T> = {
        data,
        timestamp: Date.now(),
        params
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`MABL metrics cached (key: ${cacheKey})`);
    } catch (err) {
      console.warn('Failed to cache MABL metrics:', err);
    }
  }

  clearCache(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} MABL cached entries`);
  }
}
