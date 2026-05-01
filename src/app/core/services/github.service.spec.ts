import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CredentialsService } from './credentials.service';
import { GithubService } from './github.service';
import { DeveloperGithubMetrics } from './github-metrics.mapper';

describe('GithubService', () => {
  let service: GithubService;
  let credentialsService: CredentialsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [GithubService, CredentialsService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(GithubService);
    credentialsService = TestBed.inject(CredentialsService);
    httpMock = TestBed.inject(HttpTestingController);
    credentialsService.setGithubCredentials({ organization: 'acacceptance', token: 'token' });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('loads developer detail with targeted author and reviewer searches', fakeAsync(() => {
    let result: DeveloperGithubMetrics | null | undefined;

    service.getDeveloperMetrics(
      'Arul-Ramakrishnan_acaccept',
      new Date('2025-10-30T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
      true
    ).subscribe(metrics => {
      result = metrics;
    });

    const configRequest = httpMock.expectOne('/assets/developers.config.json');
    configRequest.flush({
      projectKey: 'SER',
      developers: [
        {
          name: 'Arul Ramakrishnan',
          username: 'Arul.Ramakrishnan',
          githubUsername: 'Arul-Ramakrishnan_acaccept',
          email: 'arul@example.com'
        },
        {
          name: 'Other Developer',
          username: 'Other.Developer',
          githubUsername: 'Other-Developer_acaccept',
          email: 'other@example.com'
        }
      ]
    });

    const searchRequests = httpMock.match(req => req.url === '/github-api/search/issues');
    expect(searchRequests.length).toBe(2);
    expect(searchRequests.some(req =>
      req.request.params.get('q')?.includes('author:Arul-Ramakrishnan_acaccept')
    )).toBeTrue();
    expect(searchRequests.some(req =>
      req.request.params.get('q')?.includes('reviewed-by:Arul-Ramakrishnan_acaccept')
    )).toBeTrue();

    const authoredSearch = searchRequests.find(req => req.request.params.get('q')?.includes('author:'))!;
    const reviewedSearch = searchRequests.find(req => req.request.params.get('q')?.includes('reviewed-by:'))!;

    authoredSearch.flush({
      total_count: 1,
      incomplete_results: false,
      items: [
        {
          id: 1,
          number: 451,
          repository_url: 'https://api.github.com/repos/acacceptance-appdev/sms.core',
          html_url: 'https://github.com/acacceptance-appdev/sms.core/pull/451',
          user: { login: 'Arul-Ramakrishnan_acaccept' },
          created_at: '2026-04-28T10:00:00Z',
          state: 'open',
          pull_request: {
            url: 'https://api.github.com/repos/acacceptance-appdev/sms.core/pulls/451',
            html_url: 'https://github.com/acacceptance-appdev/sms.core/pull/451',
            merged_at: null
          }
        }
      ]
    });

    reviewedSearch.flush({
      total_count: 1,
      incomplete_results: false,
      items: [
        {
          id: 2,
          number: 100,
          repository_url: 'https://api.github.com/repos/acacceptance-appdev/sms',
          html_url: 'https://github.com/acacceptance-appdev/sms/pull/100',
          user: { login: 'Other-Developer_acaccept' },
          created_at: '2026-04-23T10:00:00Z',
          state: 'closed',
          pull_request: {
            url: 'https://api.github.com/repos/acacceptance-appdev/sms/pulls/100',
            html_url: 'https://github.com/acacceptance-appdev/sms/pull/100',
            merged_at: '2026-04-24T10:00:00Z'
          }
        }
      ]
    });

    const detailRequest = httpMock.expectOne('/github-api/repos/acacceptance-appdev/sms.core/pulls/451');
    detailRequest.flush({
      number: 451,
      additions: 645,
      deletions: 2,
      changed_files: 15,
      merged_at: null
    });

    httpMock.expectNone(req => req.url.includes('/reviews'));
    tick(100);

    expect(result).toEqual(jasmine.objectContaining({
      name: 'Arul Ramakrishnan',
      githubUsername: 'Arul-Ramakrishnan_acaccept',
      prsSubmitted: 1,
      prsReviewed: 1,
      linesAdded: 645,
      linesRemoved: 2,
      uniqueRepositories: 2
    }));
  }));
});
