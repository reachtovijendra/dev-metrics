import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, from, of } from 'rxjs';
import { catchError, delay, map, mergeMap, shareReplay, switchMap, tap, toArray } from 'rxjs/operators';
import { CredentialsService } from './credentials.service';
import { EnvironmentService } from './environment.service';
import {
  GithubPullRequestDetail,
  GithubPullRequestReview,
  GithubSearchItem,
  GithubSearchResponse
} from '../models/github.model';
import {
  buildGithubMetrics,
  ConfiguredGithubDeveloper,
  DeveloperGithubMetrics,
  GithubMetricPullRequest,
  GithubMetricsResult
} from './github-metrics.mapper';

export interface GithubDeveloperConfig {
  projectKey: string;
  developers: ConfiguredGithubDeveloper[];
}

export interface GithubMetricsLoadResult extends GithubMetricsResult {
  searchLimitExceeded: boolean;
}

interface SearchResult {
  items: GithubSearchItem[];
  exceededLimit: boolean;
}

interface PullRequestRef {
  owner: string;
  repo: string;
  fullName: string;
}

interface CacheParams {
  organization: string;
  startDate: string;
  endDate: string;
  developers: string[];
}

interface CachedData {
  data: GithubMetricsLoadResult;
  timestamp: number;
  params: CacheParams;
  version: number;
}

const CACHE_KEY_PREFIX = 'dev-metrics-gh-';
const CACHE_DURATION_MS = 15 * 60 * 1000;
const CACHE_VERSION = 2;

export function isValidGithubLogin(login: string): boolean {
  return /^[a-z\d](?:[a-z\d_-]|-(?=[a-z\d])){0,38}$/i.test(login);
}

@Injectable({
  providedIn: 'root'
})
export class GithubService {
  private http = inject(HttpClient);
  private credentialsService = inject(CredentialsService);
  private environmentService = inject(EnvironmentService);

  private configCache$: Observable<GithubDeveloperConfig> | null = null;

  private get baseUrl(): string {
    return this.environmentService.getGithubApiUrl();
  }

  getConfiguredDevelopers(): Observable<GithubDeveloperConfig> {
    if (!this.configCache$) {
      this.configCache$ = this.http.get<GithubDeveloperConfig>('/assets/developers.config.json').pipe(
        shareReplay(1),
        catchError(err => {
          console.error('Error loading developer config:', err);
          return of({ projectKey: '', developers: [] });
        })
      );
    }
    return this.configCache$;
  }

  getConfiguredDevelopersMetrics(
    startDate: Date,
    endDate: Date,
    forceRefresh = false
  ): Observable<GithubMetricsLoadResult> {
    return this.getConfiguredDevelopers().pipe(
      switchMap(config => {
        const organization = this.credentialsService.getGithubCredentials()?.organization?.trim();
        if (!organization) {
          return of(this.emptyResult());
        }

        const developers = config.developers || [];
        const cacheParams: CacheParams = {
          organization,
          startDate: this.formatDateForCache(startDate),
          endDate: this.formatDateForCache(endDate),
          developers: developers.map(dev => this.resolveDeveloperLogin(dev) || dev.username).sort()
        };

        if (!forceRefresh) {
          const cached = this.getFromCache(cacheParams);
          if (cached) {
            return of(cached.data);
          }
        }

        return this.loadGithubMetrics(organization, developers, startDate, endDate).pipe(
          tap(result => this.saveToCache(result, cacheParams))
        );
      })
    );
  }

  getDeveloperMetrics(
    githubUsername: string,
    startDate: Date,
    endDate: Date,
    forceRefresh = false
  ): Observable<DeveloperGithubMetrics | null> {
    const requestedLogin = githubUsername.trim().toLowerCase();

    return this.getConfiguredDevelopers().pipe(
      switchMap(config => {
        const organization = this.credentialsService.getGithubCredentials()?.organization?.trim();
        if (!organization || !requestedLogin) {
          return of(null);
        }

        const developer = (config.developers || []).find(dev =>
          this.resolveDeveloperLogin(dev).toLowerCase() === requestedLogin
        );
        if (!developer) {
          return of(null);
        }

        const resolvedLogin = this.resolveDeveloperLogin(developer);
        const cacheParams: CacheParams = {
          organization,
          startDate: this.formatDateForCache(startDate),
          endDate: this.formatDateForCache(endDate),
          developers: [resolvedLogin]
        };

        if (!forceRefresh) {
          const cached = this.getFromCache(cacheParams);
          if (cached) {
            return of(cached.data.developers[0] || null);
          }
        }

        return this.loadGithubDeveloperMetrics(organization, developer, resolvedLogin, startDate, endDate).pipe(
          tap(result => this.saveToCache(result, cacheParams)),
          map(result => result.developers[0] || null)
        );
      })
    );
  }

  private loadGithubMetrics(
    organization: string,
    developers: ConfiguredGithubDeveloper[],
    startDate: Date,
    endDate: Date
  ): Observable<GithubMetricsLoadResult> {
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);
    const developerLogins = developers.map(dev => this.resolveDeveloperLogin(dev)).filter(Boolean);
    const authorQuery = `is:pr org:${organization} created:${start}..${end}`;

    return this.searchPullRequests(authorQuery).pipe(
      switchMap(searchResult => {
        const reviewLoginsByKey = new Map<string, Set<string>>();
        const itemByKey = new Map<string, GithubSearchItem>();

        for (const item of searchResult.items) {
          const key = this.getPullRequestKey(item);
          if (key) {
            itemByKey.set(key, item);
          }
        }

        const configuredLogins = new Set(developerLogins.map(login => login.toLowerCase()));
        const authoredByConfiguredDevelopers = Array.from(itemByKey.values()).filter(item => {
          const login = item.user?.login?.toLowerCase();
          return !!login && configuredLogins.has(login);
        });

        return forkJoin({
          detailsByKey: this.loadPullRequestDetails(authoredByConfiguredDevelopers),
          reviewsByKey: this.loadPullRequestReviews(Array.from(itemByKey.values()))
        }).pipe(
          map(({ detailsByKey, reviewsByKey }) => {
            for (const [key, reviewers] of reviewsByKey.entries()) {
              reviewLoginsByKey.set(key, reviewers);
            }

            const normalized = Array.from(itemByKey.values()).map(item =>
              this.toMetricPullRequest(item, reviewLoginsByKey.get(this.getPullRequestKey(item) || '') || new Set(), detailsByKey)
            );
            const metrics = buildGithubMetrics(developers, normalized);
            return { ...metrics, searchLimitExceeded: searchResult.exceededLimit };
          })
        );
      }),
      catchError(err => {
        console.error('Error loading GitHub metrics:', err);
        return of(this.emptyResult());
      })
    );
  }

  private loadGithubDeveloperMetrics(
    organization: string,
    developer: ConfiguredGithubDeveloper,
    githubUsername: string,
    startDate: Date,
    endDate: Date
  ): Observable<GithubMetricsLoadResult> {
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);
    const authoredQuery = `is:pr org:${organization} author:${githubUsername} created:${start}..${end}`;
    const reviewedQuery = `is:pr org:${organization} reviewed-by:${githubUsername} created:${start}..${end}`;

    return forkJoin({
      authoredSearch: this.searchPullRequests(authoredQuery),
      reviewedSearch: this.searchPullRequests(reviewedQuery)
    }).pipe(
      switchMap(({ authoredSearch, reviewedSearch }) => {
        const itemByKey = new Map<string, GithubSearchItem>();
        const authoredKeys = new Set<string>();
        const reviewedKeys = new Set<string>();

        for (const item of authoredSearch.items) {
          const key = this.getPullRequestKey(item);
          if (key) {
            itemByKey.set(key, item);
            authoredKeys.add(key);
          }
        }

        for (const item of reviewedSearch.items) {
          const key = this.getPullRequestKey(item);
          if (key) {
            itemByKey.set(key, item);
            reviewedKeys.add(key);
          }
        }

        const authoredItems = Array.from(itemByKey.values()).filter(item => {
          const key = this.getPullRequestKey(item);
          return !!key && authoredKeys.has(key);
        });

        return this.loadPullRequestDetails(authoredItems).pipe(
          map(detailsByKey => {
            const normalized = Array.from(itemByKey.values()).map(item => {
              const key = this.getPullRequestKey(item) || '';
              return this.toMetricPullRequest(
                item,
                reviewedKeys.has(key) ? new Set([githubUsername]) : new Set(),
                detailsByKey
              );
            });
            const metrics = buildGithubMetrics([developer], normalized);
            return {
              ...metrics,
              searchLimitExceeded: authoredSearch.exceededLimit || reviewedSearch.exceededLimit
            };
          })
        );
      }),
      catchError(err => {
        console.error('Error loading GitHub developer metrics:', err);
        return of(this.emptyResult());
      })
    );
  }

  private searchPullRequests(query: string): Observable<SearchResult> {
    const fetchPage = (page: number) =>
      this.http.get<GithubSearchResponse>(`${this.baseUrl}/search/issues`, {
        params: new HttpParams()
          .set('q', query)
          .set('per_page', '100')
          .set('page', String(page))
      });

    return fetchPage(1).pipe(
      switchMap(firstPage => {
        const cappedTotal = Math.min(firstPage.total_count, 1000);
        const totalPages = Math.ceil(cappedTotal / 100);
        if (totalPages <= 1) {
          return of({
            items: firstPage.items,
            exceededLimit: firstPage.total_count > 1000
          });
        }

        const requests: Observable<GithubSearchResponse>[] = [];
        for (let page = 2; page <= totalPages; page++) {
          requests.push(fetchPage(page));
        }

        return forkJoin(requests).pipe(
          map(pages => ({
            items: [firstPage, ...pages].flatMap(page => page.items),
            exceededLimit: firstPage.total_count > 1000
          }))
        );
      }),
      catchError(err => {
        console.error('GitHub search failed:', err);
        return of({ items: [], exceededLimit: false });
      })
    );
  }

  private loadPullRequestDetails(items: GithubSearchItem[]): Observable<Map<string, GithubPullRequestDetail>> {
    if (items.length === 0) {
      return of(new Map());
    }

    return from(items).pipe(
      mergeMap(
        item => {
          const key = this.getPullRequestKey(item);
          const ref = this.parseRepositoryRef(item.repository_url);
          if (!key || !ref) {
            return of(null);
          }

          return this.http.get<GithubPullRequestDetail>(`${this.baseUrl}/repos/${ref.owner}/${ref.repo}/pulls/${item.number}`).pipe(
            map(detail => ({ key, detail })),
            catchError(() => of(null)),
            delay(80)
          );
        },
        5
      ),
      toArray(),
      map(results => {
        const details = new Map<string, GithubPullRequestDetail>();
        for (const result of results) {
          if (result) {
            details.set(result.key, result.detail);
          }
        }
        return details;
      })
    );
  }

  private loadPullRequestReviews(items: GithubSearchItem[]): Observable<Map<string, Set<string>>> {
    if (items.length === 0) {
      return of(new Map());
    }

    return from(items).pipe(
      mergeMap(
        item => {
          const key = this.getPullRequestKey(item);
          const ref = this.parseRepositoryRef(item.repository_url);
          if (!key || !ref) {
            return of(null);
          }

          return this.http.get<GithubPullRequestReview[]>(
            `${this.baseUrl}/repos/${ref.owner}/${ref.repo}/pulls/${item.number}/reviews`,
            { params: new HttpParams().set('per_page', '100') }
          ).pipe(
            map(reviews => ({
              key,
              reviewers: new Set(
                reviews
                  .map(review => review.user?.login)
                  .filter((login): login is string => !!login)
              )
            })),
            catchError(() => of(null)),
            delay(80)
          );
        },
        5
      ),
      toArray(),
      map(results => {
        const reviewsByKey = new Map<string, Set<string>>();
        for (const result of results) {
          if (result) {
            reviewsByKey.set(result.key, result.reviewers);
          }
        }
        return reviewsByKey;
      })
    );
  }

  private toMetricPullRequest(
    item: GithubSearchItem,
    reviewLogins: Set<string>,
    detailsByKey: Map<string, GithubPullRequestDetail>
  ): GithubMetricPullRequest {
    const key = this.getPullRequestKey(item) || `${item.repository_url}#${item.number}`;
    const repoRef = this.parseRepositoryRef(item.repository_url);
    const detail = detailsByKey.get(key);

    return {
      key,
      repo: repoRef?.fullName || item.repository_url,
      number: item.number,
      authorLogin: item.user?.login || '',
      createdAt: item.created_at,
      mergedAt: detail?.merged_at || item.pull_request?.merged_at || null,
      additions: detail?.additions || 0,
      deletions: detail?.deletions || 0,
      changedFiles: detail?.changed_files || 0,
      reviewLogins: Array.from(reviewLogins)
    };
  }

  private parseRepositoryRef(repositoryUrl: string): PullRequestRef | null {
    const match = repositoryUrl.match(/\/repos\/([^/]+)\/([^/]+)$/);
    if (!match) {
      return null;
    }
    return {
      owner: match[1],
      repo: match[2],
      fullName: `${match[1]}/${match[2]}`
    };
  }

  private getPullRequestKey(item: GithubSearchItem): string | null {
    const ref = this.parseRepositoryRef(item.repository_url);
    return ref ? `${ref.fullName}#${item.number}` : null;
  }

  private resolveDeveloperLogin(developer: ConfiguredGithubDeveloper): string {
    const candidate = (developer.githubUsername || developer.username).trim();
    return isValidGithubLogin(candidate) ? candidate : '';
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateForCache(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private emptyResult(): GithubMetricsLoadResult {
    return {
      ...buildGithubMetrics([], []),
      searchLimitExceeded: false
    };
  }

  private generateCacheKey(params: CacheParams): string {
    const keyString = [
      params.organization,
      params.startDate,
      params.endDate,
      ...params.developers
    ].join('|');
    return CACHE_KEY_PREFIX + this.simpleHash(keyString);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getFromCache(params: CacheParams): CachedData | null {
    try {
      const cacheKey = this.generateCacheKey(params);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return null;
      }

      const parsed: CachedData = JSON.parse(cached);
      if (parsed.version !== CACHE_VERSION) {
        localStorage.removeItem(cacheKey);
        return null;
      }
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

  private saveToCache(data: GithubMetricsLoadResult, params: CacheParams): void {
    try {
      localStorage.setItem(this.generateCacheKey(params), JSON.stringify({
        data,
        timestamp: Date.now(),
        params,
        version: CACHE_VERSION
      }));
    } catch (err) {
      console.warn('Failed to cache GitHub metrics:', err);
    }
  }

  clearCache(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  testConnection(): Observable<boolean> {
    return this.http.get<unknown>(`${this.baseUrl}/user`).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}

export type { DeveloperGithubMetrics };
