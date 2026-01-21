import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { CredentialsService } from './credentials.service';
import { EnvironmentService } from './environment.service';
import {
  CursorTeamMember,
  CursorDailyUsageRequest,
  CursorDailyUsageResponse,
  CursorAggregatedMetrics,
  CursorSpendingRequest,
  CursorSpendingResponse,
  CursorTeamMemberSpend
} from '../models/cursor.model';
import { CursorMetrics, DateRange } from '../models/developer.model';

// Analytics API response interfaces (matches CSV exports)
interface AnalyticsLeaderboardResponse {
  data: {
    tab_leaderboard: {
      data: AnalyticsTabLeaderboardEntry[];
      total_users: number;
    };
    agent_leaderboard: {
      data: AnalyticsAgentLeaderboardEntry[];
      total_users: number;
    };
  };
  pagination: {
    page: number;
    pageSize: number;
    totalUsers: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  params: {
    metric: string;
    teamId: number;
    startDate: string;
    endDate: string;
  };
}

interface AnalyticsTabLeaderboardEntry {
  email: string;
  user_id: string;
  total_accepts: number;          // Tab completions accepted - MATCHES CSV!
  total_lines_accepted: number;   // Lines from tab - MATCHES CSV!
  total_lines_suggested: number;
  line_acceptance_ratio: number;
  accept_ratio: number;
  rank: number;
}

interface AnalyticsAgentLeaderboardEntry {
  email: string;
  user_id: string;
  total_accepts: number;          // Agent edits accepted
  total_lines_accepted: number;   // Agent lines accepted - MATCHES CSV!
  total_lines_suggested: number;
  line_acceptance_ratio: number;
  favorite_model?: string;
  rank: number;
}

// Model usage by user response
interface ModelUsageByUserResponse {
  data: { [email: string]: ModelUsageDayEntry[] };
  pagination: {
    page: number;
    pageSize: number;
    totalUsers: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  params: {
    metric: string;
    teamId: number;
    startDate: string;
    endDate: string;
  };
}

// Actual API structure: each entry is a day with model_breakdown
interface ModelUsageDayEntry {
  date: string;
  model_breakdown: {
    [model: string]: {
      messages: number;
      users: number;
    };
  };
}

// Cache interface for Cursor data
interface CachedCursorData {
  data: CursorAggregatedMetrics[];
  timestamp: number;
  startDate: string;
  endDate: string;
}

@Injectable({
  providedIn: 'root'
})
export class CursorService {
  private http = inject(HttpClient);
  private credentialsService = inject(CredentialsService);
  private environmentService = inject(EnvironmentService);

  // Dynamic base URL: uses Vercel serverless in production, local proxy in dev
  private get baseUrl(): string {
    return this.environmentService.getCursorApiUrl();
  }
  
  private readonly CACHE_KEY = 'cursor_metrics_cache';
  private readonly CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Get team members from Cursor Admin API
   * Endpoint: GET /teams/members
   */
  getTeamMembers(): Observable<CursorTeamMember[]> {
    return this.http.get<{ teamMembers: CursorTeamMember[] }>(
      `${this.baseUrl}/teams/members`
    ).pipe(
      map(response => response.teamMembers || []),
      catchError(err => {
        console.error('Error fetching team members:', err);
        return of([]);
      })
    );
  }

  /**
   * Get daily usage data from Cursor Admin API
   * Endpoint: POST /teams/daily-usage-data
   * Note: Poll at most once per hour (data aggregated hourly)
   */
  getDailyUsage(dateRange: DateRange): Observable<CursorDailyUsageResponse> {
    const request: CursorDailyUsageRequest = {
      startDate: this.formatDate(dateRange.startDate),
      endDate: this.formatDate(dateRange.endDate)
    };

    console.log('=== DAILY USAGE API REQUEST ===');
    console.log('URL:', `${this.baseUrl}/teams/daily-usage-data`);
    console.log('Request body:', request);

    return this.http.post<CursorDailyUsageResponse>(
      `${this.baseUrl}/teams/daily-usage-data`,
      request
    ).pipe(
      tap(response => {
        console.log('=== DAILY USAGE API RESPONSE ===');
        console.log('Total records:', response.data?.length || 0);
        if (response.data?.length > 0) {
          console.log('Sample record:', response.data[0]);
          // Log fields that contribute to activeDays and requests
          const sample = response.data[0];
          console.log('Sample fields - composerRequests:', sample.composerRequests, 
                      'chatRequests:', sample.chatRequests, 
                      'agentRequests:', sample.agentRequests,
                      'acceptedLinesAdded:', sample.acceptedLinesAdded,
                      'totalTabsAccepted:', sample.totalTabsAccepted);
        }
      }),
      catchError(err => {
        console.error('Error fetching daily usage:', err);
        return of({ data: [] });
      })
    );
  }
  
  /**
   * Format date as YYYY-MM-DD for API
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get aggregated metrics for all team members
   * Aggregates daily usage data by user
   */
  getAggregatedMetrics(dateRange: DateRange, forceRefresh = false): Observable<CursorAggregatedMetrics[]> {
    // Check cache first
    if (!forceRefresh) {
      const cached = this.getFromCache(dateRange);
      if (cached) {
        console.log('Using cached Cursor metrics');
        return of(cached);
      }
    }

    return this.getDailyUsage(dateRange).pipe(
      map(response => {
        const userMetricsMap = new Map<string, CursorAggregatedMetrics>();

        for (const dailyUsage of response.data) {
          const existing = userMetricsMap.get(dailyUsage.userId);
          // Metrics are at top level, not nested under 'metrics'
          const d = dailyUsage;

          // CORRECT MAPPING to match Cursor CSV exports:
          // - acceptedLinesAdded = AI lines (agent lines + tab lines accepted)
          // - totalTabsAccepted = Tab Completions (accepted, not shown)
          // - totalAccepts = Agent completions accepted

          // Check if there was actual activity on this day
          // Activity = any requests made OR any lines generated/accepted OR any tabs
          const dailyRequests = (d.composerRequests || 0) + (d.chatRequests || 0) + (d.agentRequests || 0);
          const hadActivity = dailyRequests > 0 || 
                              (d.acceptedLinesAdded || 0) > 0 || 
                              (d.totalTabsAccepted || 0) > 0;

          if (existing) {
            existing.totalLinesGenerated += d.acceptedLinesAdded; // Use ACCEPTED lines, not total lines
            existing.acceptedLinesAdded += d.acceptedLinesAdded;
            existing.totalTabsShown += d.totalTabsShown;
            existing.totalTabsAccepted += d.totalTabsAccepted;
            existing.totalRequests += dailyRequests;
            existing.spendingUsd += d.usageBasedReqs * 0.01;
            // Only count as active day if there was actual activity
            if (hadActivity) {
              existing.activeDays += 1;
            }
          } else {
            userMetricsMap.set(d.userId, {
              userId: d.userId,
              email: d.email,
              name: '', // Name not in daily usage response - matched later from team members
              totalLinesGenerated: d.acceptedLinesAdded, // Use ACCEPTED lines to match CSV "AI Lines"
              acceptedLinesAdded: d.acceptedLinesAdded,
              totalTabsShown: d.totalTabsShown,
              totalTabsAccepted: d.totalTabsAccepted,
              tabAcceptanceRate: 0, // Calculate after aggregation
              totalRequests: dailyRequests,
              spendingUsd: d.usageBasedReqs * 0.01,
              // Only count as active day if there was actual activity
              activeDays: hadActivity ? 1 : 0
            });
          }
        }

        // Calculate acceptance rates
        const aggregatedMetrics = Array.from(userMetricsMap.values()).map(m => ({
          ...m,
          tabAcceptanceRate: m.totalTabsShown > 0 
            ? Math.round((m.totalTabsAccepted / m.totalTabsShown) * 100) 
            : 0
        }));

        // Save to cache
        this.saveToCache(aggregatedMetrics, dateRange);

        return aggregatedMetrics;
      })
    );
  }

  /**
   * Get metrics for configured developers (from developers.config.json)
   * Maps Cursor users to configured developers by email
   */
  getMetricsForConfiguredDevelopers(
    developers: { name: string; email: string }[],
    dateRange: DateRange,
    forceRefresh = false
  ): Observable<CursorAggregatedMetrics[]> {
    return this.getAggregatedMetrics(dateRange, forceRefresh).pipe(
      map(allMetrics => {
        // Match configured developers to Cursor users by email
        return developers.map(dev => {
          const cursorUser = allMetrics.find(
            m => m.email.toLowerCase() === dev.email.toLowerCase()
          );

          if (cursorUser) {
            return { ...cursorUser, name: dev.name }; // Use config name
          }

          // Return empty metrics for developers not found in Cursor
          return {
            userId: '',
            email: dev.email,
            name: dev.name,
            totalLinesGenerated: 0,
            acceptedLinesAdded: 0,
            totalTabsShown: 0,
            totalTabsAccepted: 0,
            tabAcceptanceRate: 0,
            totalRequests: 0,
            spendingUsd: 0,
            activeDays: 0
          };
        });
      })
    );
  }

  /**
   * Cache management
   */
  private getCacheKey(dateRange: DateRange): string {
    return `${this.CACHE_KEY}_${this.formatDate(dateRange.startDate)}_${this.formatDate(dateRange.endDate)}`;
  }

  private getFromCache(dateRange: DateRange): CursorAggregatedMetrics[] | null {
    try {
      const key = this.getCacheKey(dateRange);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const parsed: CachedCursorData = JSON.parse(cached);
      const now = Date.now();

      if (now - parsed.timestamp > this.CACHE_DURATION_MS) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  }

  private saveToCache(data: CursorAggregatedMetrics[], dateRange: DateRange): void {
    try {
      const key = this.getCacheKey(dateRange);
      const cacheData: CachedCursorData = {
        data,
        timestamp: Date.now(),
        startDate: this.formatDate(dateRange.startDate),
        endDate: this.formatDate(dateRange.endDate)
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Failed to cache Cursor metrics:', e);
    }
  }

  clearCache(): void {
    // Clear all cursor cache entries
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.CACHE_KEY));
    keys.forEach(k => localStorage.removeItem(k));
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

  /**
   * Get spending data for the current billing cycle
   * Endpoint: POST /teams/spend
   * Returns spending per team member in the current billing cycle
   */
  getSpendingData(options: CursorSpendingRequest = {}): Observable<CursorSpendingResponse> {
    const request: CursorSpendingRequest = {
      sortBy: options.sortBy || 'amount',
      sortDirection: options.sortDirection || 'desc',
      page: options.page || 1,
      pageSize: options.pageSize || 100,
      ...options
    };

    return this.http.post<CursorSpendingResponse>(
      `${this.baseUrl}/teams/spend`,
      request
    ).pipe(
      catchError(err => {
        console.error('Error fetching spending data:', err);
        return of({
          teamMemberSpend: [],
          subscriptionCycleStart: Date.now(),
          totalMembers: 0,
          totalPages: 0
        });
      })
    );
  }

  /**
   * Get ALL spending data by fetching all pages
   * This ensures we capture spending for all team members
   */
  getAllSpendingData(): Observable<CursorSpendingResponse> {
    // First fetch to get total pages
    return this.getSpendingData({ page: 1, pageSize: 100 }).pipe(
      switchMap(firstPage => {
        if (firstPage.totalPages <= 1) {
          console.log('Spending data: Single page, total members:', firstPage.totalMembers);
          return of(firstPage);
        }

        // Fetch remaining pages
        const pageRequests: Observable<CursorSpendingResponse>[] = [];
        for (let page = 2; page <= firstPage.totalPages; page++) {
          pageRequests.push(this.getSpendingData({ page, pageSize: 100 }));
        }

        return forkJoin(pageRequests).pipe(
          map(additionalPages => {
            // Combine all team member spending from all pages
            const allMembers = [
              ...firstPage.teamMemberSpend,
              ...additionalPages.flatMap(p => p.teamMemberSpend)
            ];

            console.log(`Spending data: ${firstPage.totalPages} pages, ${allMembers.length} total members fetched`);

            return {
              ...firstPage,
              teamMemberSpend: allMembers
            };
          })
        );
      }),
      tap(response => {
        // Calculate total using overallSpendCents
        const totalCents = response.teamMemberSpend.reduce(
          (sum, m: any) => sum + (m.overallSpendCents || m.spendCents || 0), 0
        );
        console.log('Total spending from API (all pages):', `$${(totalCents / 100).toFixed(2)}`);
      })
    );
  }

  /**
   * Get spending for a specific developer by email
   */
  getSpendingByEmail(email: string): Observable<CursorTeamMemberSpend | null> {
    return this.getSpendingData({ searchTerm: email }).pipe(
      map(response => {
        const member = response.teamMemberSpend.find(
          m => m.email.toLowerCase() === email.toLowerCase()
        );
        return member || null;
      })
    );
  }

  /**
   * Test connection to Cursor API
   * Returns true if API is accessible
   */
  testConnection(): Observable<boolean> {
    return this.getTeamMembers().pipe(
      map(members => {
        console.log('Cursor API connection successful, found', members.length, 'team members');
        return true;
      }),
      catchError(err => {
        console.error('Cursor API connection failed:', err);
        return of(false);
      })
    );
  }

  /**
   * Get Analytics API Leaderboard data
   * This endpoint returns EXACT matches to CSV exports!
   * Endpoint: GET /analytics/team/leaderboard
   * Note: Enterprise only
   */
  getAnalyticsLeaderboard(dateRange: DateRange, users?: string[]): Observable<AnalyticsLeaderboardResponse> {
    // Don't use users filter - get all users and filter client-side
    let params = new HttpParams()
      .set('startDate', this.formatDate(dateRange.startDate))
      .set('endDate', this.formatDate(dateRange.endDate))
      .set('pageSize', '250'); // Max allowed is 250

    console.log('=== ANALYTICS API REQUEST ===');
    console.log('URL:', `${this.baseUrl}/analytics/team/leaderboard`);
    console.log('Params:', params.toString());

    return this.http.get<AnalyticsLeaderboardResponse>(
      `${this.baseUrl}/analytics/team/leaderboard`,
      { params }
    ).pipe(
      tap(response => {
        console.log('=== ANALYTICS API LEADERBOARD RESPONSE ===');
        console.log('Raw response:', response);
        console.log('Total users:', response.pagination?.totalUsers || 'unknown');
        // Log sample data
        const tabData = response.data?.tab_leaderboard?.data || [];
        const agentData = response.data?.agent_leaderboard?.data || [];
        if (tabData.length > 0) {
          console.log('Tab leaderboard sample:', tabData[0]);
        }
        if (agentData.length > 0) {
          console.log('Agent leaderboard sample:', agentData[0]);
        }
      }),
      catchError(err => {
        console.error('Error fetching analytics leaderboard:', err);
        console.error('Status:', err.status);
        console.error('Message:', err.message);
        console.error('Error body:', err.error);
        // Return empty response structure
        return of({
          data: {
            tab_leaderboard: { data: [], total_users: 0 },
            agent_leaderboard: { data: [], total_users: 0 }
          },
          pagination: { page: 1, pageSize: 500, totalUsers: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
          params: { metric: 'leaderboard', teamId: 0, startDate: '', endDate: '' }
        });
      })
    );
  }

  /**
   * Get Model Usage by User from Analytics API
   * This allows us to calculate the favorite (most used) model for each developer
   */
  getModelUsageByUser(dateRange: DateRange, emails?: string[]): Observable<ModelUsageByUserResponse> {
    // Don't filter by users initially - get all data and filter client-side
    // The users filter seems to have issues with certain email formats
    const params = new HttpParams()
      .set('startDate', this.formatDate(dateRange.startDate))
      .set('endDate', this.formatDate(dateRange.endDate))
      .set('pageSize', '250');

    console.log('=== MODEL USAGE BY USER REQUEST ===');
    console.log('URL:', `${this.baseUrl}/analytics/by-user/models`);
    console.log('Params:', params.toString());

    return this.http.get<ModelUsageByUserResponse>(
      `${this.baseUrl}/analytics/by-user/models`,
      { params }
    ).pipe(
      catchError(err => {
        console.warn('Model usage API error:', err);
        return of({
          data: {},
          pagination: { page: 1, pageSize: 250, totalUsers: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
          params: { metric: 'models', teamId: 0, startDate: '', endDate: '' }
        });
      })
    );
  }

  /**
   * Calculate favorite model from model usage data
   * Returns the model with highest total usage (messages) for each user
   */
  private calculateFavoriteModels(modelUsageData: { [email: string]: ModelUsageDayEntry[] }): Map<string, string> {
    const favoriteModels = new Map<string, string>();

    for (const [email, dayEntries] of Object.entries(modelUsageData)) {
      // Aggregate messages by model across all days
      const modelTotals = new Map<string, number>();
      
      for (const dayEntry of dayEntries) {
        const breakdown = dayEntry.model_breakdown || {};
        for (const [model, stats] of Object.entries(breakdown)) {
          const current = modelTotals.get(model) || 0;
          modelTotals.set(model, current + (stats.messages || 0));
        }
      }

      // Find model with highest usage
      let maxUsage = 0;
      let favoriteModel = '—';
      for (const [model, usage] of modelTotals.entries()) {
        if (usage > maxUsage) {
          maxUsage = usage;
          favoriteModel = this.formatModelName(model);
        }
      }

      favoriteModels.set(email.toLowerCase(), favoriteModel);
    }

    return favoriteModels;
  }

  /**
   * Format model name for display (e.g., "claude-4.5-sonnet-thinking" -> "Claude 4.5 Sonnet")
   */
  private formatModelName(modelId: string): string {
    if (!modelId) return '—';
    
    const lowerModel = modelId.toLowerCase();
    
    // Handle thinking models - extract base name
    let baseName = lowerModel.replace(/-thinking$/, '').replace(/-high-thinking$/, '');
    
    // Common model name mappings (handle various API formats)
    const modelNames: { [key: string]: string } = {
      // Claude models
      'claude-4.5-sonnet': 'Claude 4.5 Sonnet',
      'claude-4.5-opus': 'Claude 4.5 Opus',
      'claude-sonnet-4.5': 'Claude Sonnet 4.5',
      'claude-opus-4.5': 'Claude Opus 4.5',
      'claude-sonnet-4': 'Claude Sonnet 4',
      'claude-opus-4': 'Claude Opus 4',
      // GPT models
      'gpt-4o': 'GPT-4o',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      // Gemini models
      'gemini-3-flash': 'Gemini 3 Flash',
      'gemini-3-pro': 'Gemini 3 Pro',
      'gemini-2-flash': 'Gemini 2 Flash',
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      // Cursor models
      'cursor-fast': 'Cursor Fast',
      'composer-1': 'Composer 1',
      'composer 1': 'Composer 1',
    };
    
    return modelNames[baseName] || this.titleCase(baseName);
  }
  
  /**
   * Convert hyphenated string to title case
   */
  private titleCase(str: string): string {
    return str.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get metrics using Analytics API (matches CSV exports exactly)
   * Falls back to Admin API if Analytics API fails
   */
  getMetricsFromAnalyticsAPI(
    developers: { name: string; email: string }[],
    dateRange: DateRange
  ): Observable<CursorAggregatedMetrics[]> {
    const developerEmails = developers.map(d => d.email);
    
    // Fetch both leaderboard and model usage in parallel
    return forkJoin({
      leaderboard: this.getAnalyticsLeaderboard(dateRange),
      modelUsage: this.getModelUsageByUser(dateRange, developerEmails)
    }).pipe(
      map(({ leaderboard, modelUsage }) => {
        const tabData = leaderboard.data?.tab_leaderboard?.data || [];
        const agentData = leaderboard.data?.agent_leaderboard?.data || [];

        // Create lookup maps by email
        const tabByEmail = new Map(tabData.map(t => [t.email.toLowerCase(), t]));
        const agentByEmail = new Map(agentData.map(a => [a.email.toLowerCase(), a]));
        
        // Calculate favorite models from usage data
        const favoriteModels = this.calculateFavoriteModels(modelUsage.data || {});

        // Map to our internal format
        return developers.map(dev => {
          const emailLower = dev.email.toLowerCase();
          const tab = tabByEmail.get(emailLower);
          const agent = agentByEmail.get(emailLower);

          // Analytics API values MATCH CSV exports!
          const agentLinesAccepted = agent?.total_lines_accepted || 0;
          const tabLinesAccepted = tab?.total_lines_accepted || 0;
          const tabCompletions = tab?.total_accepts || 0; // Tab completions accepted
          const totalLinesAccepted = agentLinesAccepted + tabLinesAccepted; // All AI lines (agent + tab)
          
          // Get favorite model from our calculated map (since API doesn't return it)
          const favoriteModel = favoriteModels.get(emailLower) || '—';

          return {
            userId: agent?.user_id || tab?.user_id || '',
            email: dev.email,
            name: dev.name,
            totalLinesGenerated: totalLinesAccepted, // All AI-generated lines (agent + tab) = "AI Lines Total" in CSV
            acceptedLinesAdded: totalLinesAccepted, // Same value (these are all accepted lines)
            totalTabsShown: tab?.total_lines_suggested || 0,
            totalTabsAccepted: tabCompletions, // This is "Tab Completions" in CSV
            tabAcceptanceRate: tab?.accept_ratio ? Math.round(tab.accept_ratio * 100) : 0,
            totalRequests: 0, // Not in Analytics API - will be filled from Admin API
            spendingUsd: 0,
            activeDays: 0,
            favoriteModel: favoriteModel
          };
        });
      }),
      catchError(err => {
        console.warn('Analytics API failed, falling back to Admin API:', err);
        // Fall back to Admin API
        return this.getMetricsForConfiguredDevelopers(developers, dateRange, true);
      })
    );
  }

  /**
   * Get total team metrics summary
   */
  getTeamSummary(dateRange: DateRange): Observable<{
    totalLinesGenerated: number;
    totalLinesAccepted: number;
    totalTabCompletions: number;
    totalSpending: number;
    composerRequests: number;
    chatRequests: number;
    agentRequests: number;
    usageBasedRequests: number;
    activeUsers: number;
  }> {
    return this.getDailyUsage(dateRange).pipe(
      map(response => {
        const summary = {
          totalLinesGenerated: 0,
          totalLinesAccepted: 0,
          totalTabCompletions: 0,
          totalSpending: 0,
          composerRequests: 0,
          chatRequests: 0,
          agentRequests: 0,
          usageBasedRequests: 0,
          activeUsers: new Set<string>()
        };

        for (const usage of response.data) {
          // CORRECT MAPPING to match Cursor CSV exports:
          // - acceptedLinesAdded = AI lines (what the CSV calls "AI Lines")
          // - totalTabsAccepted = Tab Completions (accepted, not shown)
          summary.totalLinesGenerated += usage.acceptedLinesAdded; // Use ACCEPTED lines to match CSV
          summary.totalLinesAccepted += usage.acceptedLinesAdded;
          summary.totalTabCompletions += usage.totalTabsAccepted; // Use ACCEPTED tabs, not shown
          summary.totalSpending += usage.usageBasedReqs * 0.01;
          summary.composerRequests += usage.composerRequests;
          summary.chatRequests += usage.chatRequests;
          summary.agentRequests += usage.agentRequests;
          summary.usageBasedRequests += usage.usageBasedReqs;
          summary.activeUsers.add(usage.userId);
        }

        return {
          ...summary,
          activeUsers: summary.activeUsers.size
        };
      })
    );
  }
}


