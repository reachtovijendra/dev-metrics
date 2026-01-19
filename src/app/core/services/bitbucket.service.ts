import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of, from } from 'rxjs';
import { map, catchError, switchMap, shareReplay, mergeMap, toArray, delay, concatMap } from 'rxjs/operators';
import { CredentialsService } from './credentials.service';
import {
  BitbucketPagedResponse,
  BitbucketProject,
  BitbucketRepository,
  BitbucketPullRequest,
  BitbucketCommit,
  BitbucketActivity,
  BitbucketUser,
  BitbucketDiffStats
} from '../models/bitbucket.model';
import { BitbucketMetrics, DateRange } from '../models/developer.model';

// Config file interface
export interface DeveloperConfig {
  projectKey: string;
  developers: ConfiguredDeveloper[];
}

export interface ConfiguredDeveloper {
  name: string;
  username: string;
  email: string;
}

// Cache configuration
const CACHE_KEY_PREFIX = 'dev-metrics-bb-';
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface CacheParams {
  startDate: string;  // ISO date string (YYYY-MM-DD)
  endDate: string;    // ISO date string (YYYY-MM-DD)
  projectKey: string;
  developers: string[]; // usernames
}

interface CachedData {
  data: DeveloperBitbucketData[];
  timestamp: number;
  params: CacheParams;
}

@Injectable({
  providedIn: 'root'
})
export class BitbucketService {
  private http = inject(HttpClient);
  private credentialsService = inject(CredentialsService);

  private get baseUrl(): string {
    // Use same pattern as metric-miner - /rest/api/latest is proxied to Bitbucket
    return '/rest/api/latest';
  }

  private getPagedResults<T>(url: string, params?: HttpParams): Observable<T[]> {
    const fetchPage = (start: number): Observable<BitbucketPagedResponse<T>> => {
      const pageParams = (params || new HttpParams()).set('start', start.toString()).set('limit', '100');
      return this.http.get<BitbucketPagedResponse<T>>(url, { params: pageParams });
    };

    return fetchPage(0).pipe(
      switchMap(firstPage => {
        if (firstPage.isLastPage) {
          return of(firstPage.values);
        }
        
        const pages: Observable<BitbucketPagedResponse<T>>[] = [of(firstPage)];
        let nextStart = firstPage.nextPageStart || firstPage.size;
        
        // Estimate total pages and fetch them
        while (nextStart !== undefined && pages.length < 50) { // Safety limit
          pages.push(fetchPage(nextStart));
          nextStart = nextStart + 100;
        }
        
        return forkJoin(pages).pipe(
          map(responses => responses.flatMap(r => r.values))
        );
      }),
      catchError(() => of([]))
    );
  }

  getProjects(): Observable<BitbucketProject[]> {
    return this.getPagedResults<BitbucketProject>(`${this.baseUrl}/projects`);
  }

  getRepositories(projectKey: string): Observable<BitbucketRepository[]> {
    return this.getPagedResults<BitbucketRepository>(
      `${this.baseUrl}/projects/${projectKey}/repos`
    );
  }

  // Target project for metrics - can be made configurable later
  private readonly targetProjectKey = 'SER'; // ServicingIT project

  getAllRepositories(): Observable<BitbucketRepository[]> {
    // Only fetch repos from the target project to avoid overloading Bitbucket
    console.log(`Fetching repositories from project: ${this.targetProjectKey}`);
    return this.getRepositories(this.targetProjectKey).pipe(
      catchError(err => {
        console.error(`Error fetching repos from ${this.targetProjectKey}:`, err);
        return of([]);
      })
    );
  }

  getPullRequests(
    projectKey: string,
    repoSlug: string,
    state: 'ALL' | 'OPEN' | 'MERGED' | 'DECLINED' = 'ALL'
  ): Observable<BitbucketPullRequest[]> {
    const params = new HttpParams().set('state', state);
    return this.getPagedResults<BitbucketPullRequest>(
      `${this.baseUrl}/projects/${projectKey}/repos/${repoSlug}/pull-requests`,
      params
    );
  }

  getPullRequestActivities(
    projectKey: string,
    repoSlug: string,
    prId: number
  ): Observable<BitbucketActivity[]> {
    return this.getPagedResults<BitbucketActivity>(
      `${this.baseUrl}/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/activities`
    );
  }

  getCommits(
    projectKey: string,
    repoSlug: string,
    since?: string,
    until?: string
  ): Observable<BitbucketCommit[]> {
    let params = new HttpParams();
    if (since) params = params.set('since', since);
    if (until) params = params.set('until', until);
    
    return this.getPagedResults<BitbucketCommit>(
      `${this.baseUrl}/projects/${projectKey}/repos/${repoSlug}/commits`,
      params
    );
  }

  /**
   * Get diff stats (lines added/removed) for a pull request
   * Uses the diff endpoint with contextLines=0 and parses the result
   */
  getPullRequestDiffStats(
    projectKey: string,
    repoSlug: string,
    prId: number
  ): Observable<BitbucketDiffStats> {
    const url = `${this.baseUrl}/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/diff`;
    const params = new HttpParams()
      .set('contextLines', '0')
      .set('withComments', 'false');

    return this.http.get<any>(url, { params }).pipe(
      map(response => {
        let linesAdded = 0;
        let linesRemoved = 0;

        // Parse the diff response to count lines
        if (response && response.diffs) {
          for (const diff of response.diffs) {
            if (diff.hunks) {
              for (const hunk of diff.hunks) {
                if (hunk.segments) {
                  for (const segment of hunk.segments) {
                    const lineCount = segment.lines?.length || 0;
                    if (segment.type === 'ADDED') {
                      linesAdded += lineCount;
                    } else if (segment.type === 'REMOVED') {
                      linesRemoved += lineCount;
                    }
                  }
                }
              }
            }
          }
        }

        return { linesAdded, linesRemoved };
      }),
      catchError(err => {
        // If diff is too large or unavailable, return zeros
        console.debug(`Could not get diff stats for PR ${prId}:`, err.status);
        return of({ linesAdded: 0, linesRemoved: 0 });
      })
    );
  }

  getDeveloperMetrics(
    userSlug: string,
    dateRange: DateRange
  ): Observable<BitbucketMetrics> {
    const startTime = dateRange.startDate.getTime();
    const endTime = dateRange.endDate.getTime();

    return this.getAllRepositories().pipe(
      switchMap(repos => {
        if (repos.length === 0) {
          return of(this.emptyMetrics());
        }

        const prRequests = repos.map(repo =>
          this.getPullRequests(repo.project.key, repo.slug, 'ALL').pipe(
            catchError(() => of([] as BitbucketPullRequest[]))
          )
        );

        return forkJoin(prRequests).pipe(
          map(prArrays => {
            const allPrs = prArrays.flat().filter(pr => {
              const createdDate = pr.createdDate;
              return createdDate >= startTime && createdDate <= endTime;
            });

            const prsSubmitted = allPrs.filter(pr => 
              pr.author.user.slug.toLowerCase() === userSlug.toLowerCase()
            );
            
            const prsReviewed = allPrs.filter(pr =>
              pr.reviewers.some(r => r.user.slug.toLowerCase() === userSlug.toLowerCase())
            );

            const mergedPrs = prsSubmitted.filter(pr => pr.state === 'MERGED');
            const openPrs = prsSubmitted.filter(pr => pr.state === 'OPEN');

            return {
              linesAdded: 0, // Would require fetching diffs for each PR
              linesRemoved: 0,
              prsSubmitted: prsSubmitted.length,
              prsReviewed: prsReviewed.length,
              prCommentsAdded: 0, // Would require fetching activities
              prCommentsReceived: 0,
              commits: 0, // Would require fetching commits
              avgPrSize: 0,
              mergedPrs: mergedPrs.length,
              openPrs: openPrs.length
            };
          })
        );
      }),
      catchError(() => of(this.emptyMetrics()))
    );
  }

  getDetailedDeveloperMetrics(
    userSlug: string,
    dateRange: DateRange,
    repos: BitbucketRepository[]
  ): Observable<BitbucketMetrics> {
    const startTime = dateRange.startDate.getTime();
    const endTime = dateRange.endDate.getTime();

    return forkJoin(
      repos.map(repo => this.getPullRequests(repo.project.key, repo.slug, 'ALL'))
    ).pipe(
      switchMap(prArrays => {
        const allPrs = prArrays.flat().filter(pr => {
          const createdDate = pr.createdDate;
          return createdDate >= startTime && createdDate <= endTime;
        });

        const prsSubmitted = allPrs.filter(pr => 
          pr.author.user.slug.toLowerCase() === userSlug.toLowerCase()
        );
        
        const prsReviewed = allPrs.filter(pr =>
          pr.reviewers.some(r => r.user.slug.toLowerCase() === userSlug.toLowerCase())
        );

        // Get activities for comment counts
        const activityRequests = allPrs.slice(0, 50).map(pr => // Limit to avoid too many requests
          this.getPullRequestActivities(
            pr.toRef.repository.project.key,
            pr.toRef.repository.slug,
            pr.id
          ).pipe(catchError(() => of([] as BitbucketActivity[])))
        );

        return forkJoin(activityRequests.length > 0 ? activityRequests : [of([])]).pipe(
          map(activityArrays => {
            const allActivities = activityArrays.flat();
            
            const commentsAdded = allActivities.filter(a => 
              a.action === 'COMMENTED' && 
              a.user.slug.toLowerCase() === userSlug.toLowerCase()
            ).length;

            const userPrIds = new Set(prsSubmitted.map(pr => pr.id));
            const commentsReceived = allActivities.filter(a =>
              a.action === 'COMMENTED' &&
              a.user.slug.toLowerCase() !== userSlug.toLowerCase() &&
              userPrIds.has(a.id) // This is simplified - would need proper PR ID matching
            ).length;

            return {
              linesAdded: 0,
              linesRemoved: 0,
              prsSubmitted: prsSubmitted.length,
              prsReviewed: prsReviewed.length,
              prCommentsAdded: commentsAdded,
              prCommentsReceived: commentsReceived,
              commits: 0,
              avgPrSize: 0,
              mergedPrs: prsSubmitted.filter(pr => pr.state === 'MERGED').length,
              openPrs: prsSubmitted.filter(pr => pr.state === 'OPEN').length
            };
          })
        );
      }),
      catchError(() => of(this.emptyMetrics()))
    );
  }

  private emptyMetrics(): BitbucketMetrics {
    return {
      linesAdded: 0,
      linesRemoved: 0,
      prsSubmitted: 0,
      prsReviewed: 0,
      prCommentsAdded: 0,
      prCommentsReceived: 0,
      commits: 0,
      avgPrSize: 0,
      mergedPrs: 0,
      openPrs: 0
    };
  }

  // ============================================
  // CONFIG-BASED DEVELOPER METHODS (OPTIMIZED)
  // ============================================

  private configCache$: Observable<DeveloperConfig> | null = null;

  /**
   * Load developers from the config file (cached)
   */
  getConfiguredDevelopers(): Observable<DeveloperConfig> {
    if (!this.configCache$) {
      this.configCache$ = this.http.get<DeveloperConfig>('/assets/developers.config.json').pipe(
        shareReplay(1),
        catchError(err => {
          console.error('Error loading developer config:', err);
          return of({ projectKey: 'SER', developers: [] });
        })
      );
    }
    return this.configCache$;
  }

  /**
   * Get PRs authored by a specific user in a project (optimized - single API call per repo)
   */
  getPRsByAuthor(projectKey: string, username: string, sinceDays: number = 30): Observable<BitbucketPullRequest[]> {
    const cutoffTime = Date.now() - (sinceDays * 24 * 60 * 60 * 1000);
    
    // Use the inbox endpoint which is much faster for user-specific queries
    const params = new HttpParams()
      .set('state', 'ALL')
      .set('role', 'AUTHOR')
      .set('limit', '100');
    
    return this.http.get<BitbucketPagedResponse<BitbucketPullRequest>>(
      `${this.baseUrl}/inbox/pull-requests`,
      { params }
    ).pipe(
      map(response => response.values.filter(pr => 
        pr.createdDate >= cutoffTime &&
        pr.toRef?.repository?.project?.key === projectKey
      )),
      catchError(err => {
        console.log(`Inbox API not available, falling back to project search for ${username}`);
        // Fallback: search PRs in the project repos
        return this.searchPRsInProject(projectKey, username, 'AUTHOR', sinceDays);
      })
    );
  }

  /**
   * Get PRs where user is a reviewer in a project
   */
  getPRsAsReviewer(projectKey: string, username: string, sinceDays: number = 30): Observable<BitbucketPullRequest[]> {
    const cutoffTime = Date.now() - (sinceDays * 24 * 60 * 60 * 1000);
    
    const params = new HttpParams()
      .set('state', 'ALL')
      .set('role', 'REVIEWER')
      .set('limit', '100');
    
    return this.http.get<BitbucketPagedResponse<BitbucketPullRequest>>(
      `${this.baseUrl}/inbox/pull-requests`,
      { params }
    ).pipe(
      map(response => response.values.filter(pr => 
        pr.createdDate >= cutoffTime &&
        pr.toRef?.repository?.project?.key === projectKey
      )),
      catchError(() => {
        return this.searchPRsInProject(projectKey, username, 'REVIEWER', sinceDays);
      })
    );
  }

  /**
   * Fallback: Search PRs in project repos (used when inbox API not available)
   */
  private searchPRsInProject(
    projectKey: string, 
    username: string, 
    role: 'AUTHOR' | 'REVIEWER',
    sinceDays: number
  ): Observable<BitbucketPullRequest[]> {
    const cutoffTime = Date.now() - (sinceDays * 24 * 60 * 60 * 1000);
    
    return this.getRepositories(projectKey).pipe(
      switchMap(repos => {
        if (repos.length === 0) return of([]);
        
        // Fetch PRs from all repos in parallel (limited to project repos only)
        const prRequests = repos.map(repo =>
          this.getPullRequests(projectKey, repo.slug, 'ALL').pipe(
            catchError(() => of([] as BitbucketPullRequest[]))
          )
        );

        return forkJoin(prRequests).pipe(
          map(prArrays => {
            const allPrs = prArrays.flat().filter(pr => pr.createdDate >= cutoffTime);
            
            if (role === 'AUTHOR') {
              return allPrs.filter(pr => 
                pr.author?.user?.slug?.toLowerCase() === username.toLowerCase() ||
                pr.author?.user?.emailAddress?.toLowerCase().startsWith(username.toLowerCase())
              );
            } else {
              return allPrs.filter(pr =>
                pr.reviewers?.some(r => 
                  r.user?.slug?.toLowerCase() === username.toLowerCase() ||
                  r.user?.emailAddress?.toLowerCase().startsWith(username.toLowerCase())
                )
              );
            }
          })
        );
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Get commits by a specific author in a project
   */
  getCommitsByAuthor(projectKey: string, email: string, sinceDays: number = 30): Observable<number> {
    const cutoffTime = Date.now() - (sinceDays * 24 * 60 * 60 * 1000);
    
    return this.getRepositories(projectKey).pipe(
      switchMap(repos => {
        if (repos.length === 0) return of(0);
        
        const commitRequests = repos.map(repo =>
          this.http.get<BitbucketPagedResponse<BitbucketCommit>>(
            `${this.baseUrl}/projects/${projectKey}/repos/${repo.slug}/commits`,
            { params: new HttpParams().set('limit', '100') }
          ).pipe(
            map(response => response.values.filter(c => 
              c.authorTimestamp >= cutoffTime &&
              c.author?.emailAddress?.toLowerCase() === email.toLowerCase()
            ).length),
            catchError(() => of(0))
          )
        );

        return forkJoin(commitRequests).pipe(
          map(counts => counts.reduce((sum, count) => sum + count, 0))
        );
      }),
      catchError(() => of(0))
    );
  }

  /**
   * OPTIMIZED: Get metrics for all configured developers
   * Uses config file instead of scanning repos for developers
   * Includes localStorage caching for fast subsequent loads
   * Fetches line stats from merged PRs
   * 
   * Cache key is based on: date range, project, and developer list
   */
  getConfiguredDevelopersMetrics(
    startDate: Date,
    endDate: Date,
    forceRefresh: boolean = false
  ): Observable<DeveloperBitbucketData[]> {
    // First load config to get project and developers for cache key
    return this.getConfiguredDevelopers().pipe(
      switchMap(config => {
        if (config.developers.length === 0) {
          console.log('No developers configured in config file');
          return of([]);
        }

        // Build cache params from actual parameters
        const cacheParams: CacheParams = {
          startDate: this.formatDateForCache(startDate),
          endDate: this.formatDateForCache(endDate),
          projectKey: config.projectKey,
          developers: config.developers.map(d => d.username).sort()
        };

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
          const cached = this.getFromCache(cacheParams);
          if (cached) {
            console.log('Returning cached developer metrics (age: ' + 
              Math.round((Date.now() - cached.timestamp) / 1000) + 's)');
            return of(cached.data);
          }
        }

        console.log(`Loading metrics for ${config.developers.length} configured developers from project ${config.projectKey}...`);
        console.log(`Date range: ${cacheParams.startDate} to ${cacheParams.endDate}`);
        
        // Fetch all PRs from the project
        return this.getRepositories(config.projectKey).pipe(
          switchMap(repos => {
            console.log(`Fetching PRs from ${repos.length} repositories...`);
            
            const prRequests = repos.map(repo =>
              this.getPullRequests(config.projectKey, repo.slug, 'ALL').pipe(
                catchError(() => of([] as BitbucketPullRequest[]))
              )
            );

            return forkJoin(prRequests).pipe(map(arrays => arrays.flat()));
          }),
          switchMap(prs => {
            const startTime = startDate.getTime();
            const endTime = endDate.getTime();
            const recentPrs = prs.filter(pr => pr.createdDate >= startTime && pr.createdDate <= endTime);
            
            console.log(`Found ${recentPrs.length} PRs in date range`);

            // Get all merged PRs from configured developers to fetch line stats
            const mergedPrsForDevs: BitbucketPullRequest[] = [];
            const devUsernames = new Set(config.developers.map(d => d.username.toLowerCase()));
            const devEmails = new Set(config.developers.map(d => d.email.toLowerCase()));

            for (const pr of recentPrs) {
              if (pr.state === 'MERGED') {
                const authorSlug = pr.author?.user?.slug?.toLowerCase();
                const authorEmail = pr.author?.user?.emailAddress?.toLowerCase();
                if (devUsernames.has(authorSlug || '') || devEmails.has(authorEmail || '')) {
                  mergedPrsForDevs.push(pr);
                }
              }
            }

            console.log(`Fetching line stats for ${mergedPrsForDevs.length} merged PRs...`);

            // Fetch diff stats for merged PRs (batched, 5 at a time with delay)
            if (mergedPrsForDevs.length === 0) {
              return of({ prs: recentPrs, diffStats: new Map<number, BitbucketDiffStats>() });
            }

            return from(mergedPrsForDevs).pipe(
              // Process 5 PRs at a time with delay to avoid overwhelming API
              mergeMap(pr => 
                this.getPullRequestDiffStats(
                  pr.toRef.repository.project.key,
                  pr.toRef.repository.slug,
                  pr.id
                ).pipe(
                  map(stats => ({ prId: pr.id, stats })),
                  delay(100) // Small delay between requests
                ),
                5 // Concurrency limit
              ),
              toArray(),
              map(statsArray => {
                const diffStats = new Map<number, BitbucketDiffStats>();
                for (const item of statsArray) {
                  diffStats.set(item.prId, item.stats);
                }
                return { prs: recentPrs, diffStats };
              })
            );
          }),
          map(({ prs, diffStats }) => {
            const results = config.developers.map(dev => {
              const username = dev.username.toLowerCase();
              const email = dev.email.toLowerCase();

              const prsSubmitted = prs.filter(pr => 
                pr.author?.user?.slug?.toLowerCase() === username ||
                pr.author?.user?.emailAddress?.toLowerCase() === email
              );

              const prsReviewed = prs.filter(pr =>
                pr.reviewers?.some(r => 
                  r.user?.slug?.toLowerCase() === username ||
                  r.user?.emailAddress?.toLowerCase() === email
                )
              );

              const prsMerged = prsSubmitted.filter(pr => pr.state === 'MERGED');

              // Sum up lines from merged PRs
              let linesAdded = 0;
              let linesRemoved = 0;
              for (const pr of prsMerged) {
                const stats = diffStats.get(pr.id);
                if (stats) {
                  linesAdded += stats.linesAdded;
                  linesRemoved += stats.linesRemoved;
                }
              }

              return {
                name: dev.name,
                email: dev.email,
                username: dev.username,
                prsSubmitted: prsSubmitted.length,
                prsReviewed: prsReviewed.length,
                prsMerged: prsMerged.length,
                commentsAdded: 0,
                commentsReceived: 0,
                linesAdded,
                linesRemoved,
                commitCount: 0
              };
            });

            console.log('Line stats fetched successfully');

            // Save to cache with full params
            this.saveToCache(results, cacheParams);
            return results;
          })
        );
      })
    );
  }

  /**
   * Format date for cache key (YYYY-MM-DD)
   */
  private formatDateForCache(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // ============================================
  // CACHE METHODS
  // ============================================

  /**
   * Generate a unique cache key from parameters
   * Key is based on: date range + project + developer usernames
   */
  private generateCacheKey(params: CacheParams): string {
    const keyParts = [
      params.startDate,
      params.endDate,
      params.projectKey,
      ...params.developers // already sorted
    ];
    // Simple hash: join and encode
    const keyString = keyParts.join('|');
    return CACHE_KEY_PREFIX + this.simpleHash(keyString);
  }

  /**
   * Simple hash function for cache key
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached data if valid (matches params and not expired)
   */
  private getFromCache(params: CacheParams): CachedData | null {
    try {
      const cacheKey = this.generateCacheKey(params);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const parsed: CachedData = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;

      // Check if cache is still valid (not expired)
      if (age < CACHE_DURATION_MS) {
        return parsed;
      }
      
      // Cache expired, remove it
      localStorage.removeItem(cacheKey);
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Save data to cache with full parameters
   */
  private saveToCache(data: DeveloperBitbucketData[], params: CacheParams): void {
    try {
      const cacheKey = this.generateCacheKey(params);
      const cacheData: CachedData = {
        data,
        timestamp: Date.now(),
        params
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`Developer metrics cached (key: ${cacheKey})`);
    } catch (err) {
      console.warn('Failed to cache developer metrics:', err);
    }
  }

  /**
   * Clear all developer metrics caches
   */
  clearCache(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} cached entries`);
  }

  /**
   * Get cache info for specific params (for debugging/display)
   */
  getCacheInfo(params?: CacheParams): { exists: boolean; age: number; expiresIn: number; key: string } | null {
    if (!params) return null;
    
    try {
      const cacheKey = this.generateCacheKey(params);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const parsed: CachedData = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;
      const expiresIn = Math.max(0, CACHE_DURATION_MS - age);

      return { exists: true, age, expiresIn, key: cacheKey };
    } catch {
      return null;
    }
  }

  // ============================================
  // LEGACY METHODS (kept for backwards compatibility)
  // ============================================

  /**
   * Get recent commits from a repository within a date range
   */
  getRecentCommits(
    projectKey: string,
    repoSlug: string,
    sinceDays: number = 30
  ): Observable<BitbucketCommit[]> {
    const params = new HttpParams().set('limit', '100'); // Limit to 100 most recent commits per repo
    return this.http.get<BitbucketPagedResponse<BitbucketCommit>>(
      `${this.baseUrl}/projects/${projectKey}/repos/${repoSlug}/commits`,
      { params }
    ).pipe(
      map(response => {
        const cutoffTime = Date.now() - (sinceDays * 24 * 60 * 60 * 1000);
        return response.values.filter(commit => commit.authorTimestamp >= cutoffTime);
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Get all unique developers who have committed code in the given time period
   * Uses batched processing to avoid overwhelming the browser
   */
  getActiveDevelopers(sinceDays: number = 30): Observable<BitbucketAuthorInfo[]> {
    return this.getAllRepositories().pipe(
      switchMap(repos => {
        if (repos.length === 0) return of([]);
        
        console.log(`Found ${repos.length} repositories in ServicingIT project, processing all...`);
        
        // Process all repos (limited to single project now)
        const commitRequests = repos.map(repo =>
          this.getRecentCommits(repo.project.key, repo.slug, sinceDays)
        );

        return forkJoin(commitRequests).pipe(
          map(commitArrays => commitArrays.flat()),
          map(allCommits => {
            console.log(`Processing ${allCommits.length} commits to find developers...`);
            const developerMap = new Map<string, BitbucketAuthorInfo>();

            for (const commit of allCommits) {
              const email = commit.author.emailAddress.toLowerCase();
              const existing = developerMap.get(email);
              
              if (existing) {
                existing.commitCount++;
                if (commit.authorTimestamp > existing.lastCommitDate) {
                  existing.lastCommitDate = commit.authorTimestamp;
                }
              } else {
                developerMap.set(email, {
                  name: commit.author.name,
                  email: commit.author.emailAddress,
                  username: this.extractUsername(commit.author.emailAddress),
                  commitCount: 1,
                  lastCommitDate: commit.authorTimestamp
                });
              }
            }

            console.log(`Found ${developerMap.size} unique developers`);
            // Sort by commit count descending
            return Array.from(developerMap.values())
              .sort((a, b) => b.commitCount - a.commitCount);
          })
        );
      }),
      catchError(err => {
        console.error('Error fetching developers:', err);
        return of([]);
      })
    );
  }

  /**
   * Get developers with their PR metrics
   * Uses batched processing for better performance
   */
  getDevelopersWithMetrics(sinceDays: number = 30): Observable<DeveloperBitbucketData[]> {
    const cutoffTime = Date.now() - (sinceDays * 24 * 60 * 60 * 1000);

    return forkJoin({
      developers: this.getActiveDevelopers(sinceDays),
      repos: this.getAllRepositories()
    }).pipe(
      switchMap(({ developers, repos }) => {
        if (developers.length === 0 || repos.length === 0) {
          return of([]);
        }

        console.log(`Fetching PRs from ${repos.length} repos for ${developers.length} developers...`);
        
        // Process all repos (limited to single project now)
        const prRequests = repos.map(repo =>
          this.getPullRequests(repo.project.key, repo.slug, 'ALL').pipe(
            catchError(() => of([] as BitbucketPullRequest[]))
          )
        );

        return forkJoin(prRequests).pipe(
          map(prArrays => prArrays.flat()),
          map(allPrsFlat => {
            const allPrs = allPrsFlat.filter(pr => pr.createdDate >= cutoffTime);
            console.log(`Found ${allPrs.length} PRs in date range`);

            return developers.map(dev => {
              const email = dev.email.toLowerCase();
              const username = dev.username.toLowerCase();

              const prsSubmitted = allPrs.filter(pr => 
                pr.author.user.emailAddress?.toLowerCase() === email ||
                pr.author.user.slug?.toLowerCase() === username ||
                pr.author.user.name?.toLowerCase() === dev.name.toLowerCase()
              );

              const prsReviewed = allPrs.filter(pr =>
                pr.reviewers?.some(r => 
                  r.user.emailAddress?.toLowerCase() === email ||
                  r.user.slug?.toLowerCase() === username
                )
              );

              const prsMerged = prsSubmitted.filter(pr => pr.state === 'MERGED');

              return {
                name: dev.name,
                email: dev.email,
                username: dev.username,
                prsSubmitted: prsSubmitted.length,
                prsReviewed: prsReviewed.length,
                prsMerged: prsMerged.length,
                commentsAdded: 0,
                commentsReceived: 0,
                linesAdded: 0,
                linesRemoved: 0,
                commitCount: dev.commitCount
              };
            });
          })
        );
      }),
      catchError(err => {
        console.error('Error fetching developer metrics:', err);
        return of([]);
      })
    );
  }

  private extractUsername(email: string): string {
    // Extract username from email (part before @)
    const atIndex = email.indexOf('@');
    return atIndex > 0 ? email.substring(0, atIndex) : email;
  }

  testConnection(): Observable<boolean> {
    return this.http.get<BitbucketPagedResponse<BitbucketProject>>(
      `${this.baseUrl}/projects`,
      { params: new HttpParams().set('limit', '1') }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}

// Additional interfaces for developer data
export interface BitbucketAuthorInfo {
  name: string;
  email: string;
  username: string;
  commitCount: number;
  lastCommitDate: number;
}

export interface DeveloperBitbucketData {
  name: string;
  email: string;
  username: string;
  prsSubmitted: number;
  prsReviewed: number;
  prsMerged: number;
  commentsAdded: number;
  commentsReceived: number;
  linesAdded: number;
  linesRemoved: number;
  commitCount: number;
}

