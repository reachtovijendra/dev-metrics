import {
  buildGithubMetrics,
  ConfiguredGithubDeveloper,
  getDeveloperRepositoryBreakdown,
  getWeeklyLineChanges,
  getTopRepositories,
  GithubMetricPullRequest,
  sortDevelopersByLineChanges
} from './github-metrics.mapper';
import { isValidGithubLogin } from './github.service';

describe('buildGithubMetrics', () => {
  it('accepts GitHub Enterprise managed user logins with underscores', () => {
    expect(isValidGithubLogin('Arul-Ramakrishnan_acaccept')).toBeTrue();
  });

  it('aggregates authored PRs, reviews, lines, and repositories by GitHub username', () => {
    const developers: ConfiguredGithubDeveloper[] = [
      {
        name: 'Ada Lovelace',
        username: 'ada.bitbucket',
        githubUsername: 'ada-gh',
        email: 'ada@example.com',
        manager: 'Grace Hopper',
        department: 'Engineering',
        innovationTeam: 'Platform'
      },
      {
        name: 'Linus Torvalds',
        username: 'linus',
        email: 'linus@example.com',
        manager: 'Grace Hopper',
        department: 'Engineering',
        innovationTeam: 'Kernel'
      }
    ];

    const prs: GithubMetricPullRequest[] = [
      {
        key: 'acme/api#1',
        repo: 'acme/api',
        number: 1,
        authorLogin: 'ada-gh',
        createdAt: '2026-04-01T10:00:00Z',
        mergedAt: '2026-04-02T10:00:00Z',
        additions: 120,
        deletions: 20,
        changedFiles: 5,
        reviewLogins: ['linus']
      },
      {
        key: 'acme/web#2',
        repo: 'acme/web',
        number: 2,
        authorLogin: 'ada-gh',
        createdAt: '2026-04-08T10:00:00Z',
        mergedAt: null,
        additions: 30,
        deletions: 10,
        changedFiles: 2,
        reviewLogins: []
      },
      {
        key: 'acme/web#3',
        repo: 'acme/web',
        number: 3,
        authorLogin: 'linus',
        createdAt: '2026-04-09T10:00:00Z',
        mergedAt: '2026-04-10T10:00:00Z',
        additions: 75,
        deletions: 25,
        changedFiles: 3,
        reviewLogins: ['ada-gh']
      }
    ];

    const result = buildGithubMetrics(developers, prs);

    expect(result.summary.totalPrs).toBe(3);
    expect(result.summary.prsReviewed).toBe(2);
    expect(result.summary.linesAdded).toBe(225);
    expect(result.summary.linesRemoved).toBe(55);
    expect(result.summary.uniqueRepositories).toBe(2);

    expect(result.developers[0]).toEqual(jasmine.objectContaining({
      name: 'Ada Lovelace',
      username: 'ada.bitbucket',
      githubUsername: 'ada-gh',
      prsSubmitted: 2,
      prsReviewed: 1,
      prsMerged: 1,
      openPrs: 1,
      uniqueRepositories: 2,
      linesAdded: 150,
      linesRemoved: 30,
      avgPrSize: 90,
      authoredPullRequests: [prs[0], prs[1]],
      reviewedPullRequests: [prs[2]],
      activityPullRequests: [prs[0], prs[1], prs[2]],
      manager: 'Grace Hopper',
      department: 'Engineering',
      innovationTeam: 'Platform'
    }));

    expect(result.developers[1]).toEqual(jasmine.objectContaining({
      name: 'Linus Torvalds',
      username: 'linus',
      githubUsername: 'linus',
      prsSubmitted: 1,
      prsReviewed: 1,
      prsMerged: 1,
      openPrs: 0,
      uniqueRepositories: 2,
      linesAdded: 75,
      linesRemoved: 25,
      avgPrSize: 100,
      authoredPullRequests: [prs[2]],
      reviewedPullRequests: [prs[0]],
      activityPullRequests: [prs[2], prs[0]]
    }));

    expect(result.topRepositories).toEqual([
      { repo: 'acme/web', activityCount: 2 },
      { repo: 'acme/api', activityCount: 1 }
    ]);
  });

  it('deduplicates pull requests when building filtered repository activity', () => {
    const prs: GithubMetricPullRequest[] = [
      {
        key: 'acme/api#1',
        repo: 'acme/api',
        number: 1,
        authorLogin: 'ada-gh',
        createdAt: '2026-04-01T10:00:00Z',
        mergedAt: '2026-04-02T10:00:00Z',
        additions: 1,
        deletions: 1,
        changedFiles: 1,
        reviewLogins: ['linus']
      },
      {
        key: 'acme/api#1',
        repo: 'acme/api',
        number: 1,
        authorLogin: 'ada-gh',
        createdAt: '2026-04-01T10:00:00Z',
        mergedAt: '2026-04-02T10:00:00Z',
        additions: 1,
        deletions: 1,
        changedFiles: 1,
        reviewLogins: ['linus']
      }
    ];

    expect(getTopRepositories(prs)).toEqual([{ repo: 'acme/api', activityCount: 1 }]);
  });

  it('ignores missing pull request entries from stale cached chart data', () => {
    expect(getTopRepositories([undefined, null])).toEqual([]);
  });

  it('sorts developers by highest total line changes first', () => {
    const developers = [
      { name: 'Small Change', linesAdded: 10, linesRemoved: 5 },
      { name: 'Largest Change', linesAdded: 30, linesRemoved: 40 },
      { name: 'Medium Change', linesAdded: 20, linesRemoved: 20 }
    ];

    expect(sortDevelopersByLineChanges(developers).map(dev => dev.name)).toEqual([
      'Largest Change',
      'Medium Change',
      'Small Change'
    ]);
  });

  it('builds repository breakdown for a developer activity set', () => {
    const prs: GithubMetricPullRequest[] = [
      {
        key: 'acme/api#1',
        repo: 'acme/api',
        number: 1,
        authorLogin: 'ada-gh',
        createdAt: '2026-04-01T10:00:00Z',
        mergedAt: '2026-04-02T10:00:00Z',
        additions: 100,
        deletions: 20,
        changedFiles: 4,
        reviewLogins: []
      },
      {
        key: 'acme/api#2',
        repo: 'acme/api',
        number: 2,
        authorLogin: 'ada-gh',
        createdAt: '2026-04-08T10:00:00Z',
        mergedAt: null,
        additions: 30,
        deletions: 10,
        changedFiles: 2,
        reviewLogins: []
      },
      {
        key: 'acme/web#3',
        repo: 'acme/web',
        number: 3,
        authorLogin: 'linus',
        createdAt: '2026-04-09T10:00:00Z',
        mergedAt: '2026-04-10T10:00:00Z',
        additions: 5,
        deletions: 5,
        changedFiles: 1,
        reviewLogins: ['ada-gh']
      }
    ];

    expect(getDeveloperRepositoryBreakdown(prs, 'ada-gh')).toEqual([
      {
        repo: 'acme/api',
        activityCount: 2,
        prsSubmitted: 2,
        prsReviewed: 0,
        lineChanges: 160,
        changedFiles: 6
      },
      {
        repo: 'acme/web',
        activityCount: 1,
        prsSubmitted: 0,
        prsReviewed: 1,
        lineChanges: 0,
        changedFiles: 0
      }
    ]);
  });

  it('builds weekly line-change history for the last six months', () => {
    const referenceDate = new Date('2026-04-29T00:00:00Z');
    const prs: GithubMetricPullRequest[] = [
      {
        key: 'acme/api#1',
        repo: 'acme/api',
        number: 1,
        authorLogin: 'ada-gh',
        createdAt: '2026-04-01T10:00:00Z',
        mergedAt: '2026-04-02T10:00:00Z',
        additions: 100,
        deletions: 25,
        changedFiles: 4,
        reviewLogins: []
      },
      {
        key: 'acme/api#2',
        repo: 'acme/api',
        number: 2,
        authorLogin: 'ada-gh',
        createdAt: '2026-03-27T10:00:00Z',
        mergedAt: null,
        additions: 40,
        deletions: 10,
        changedFiles: 2,
        reviewLogins: []
      }
    ];

    const history = getWeeklyLineChanges(prs, referenceDate, 6);

    expect(history.length).toBeGreaterThan(20);
    expect(history.some(week => week.linesChanged === 125 && week.prsSubmitted === 1)).toBeTrue();
    expect(history.some(week => week.linesChanged === 50 && week.prsSubmitted === 1)).toBeTrue();
    expect(history.some(week => week.label === 'Mar 22-28' && week.linesChanged === 50)).toBeTrue();
    expect(history.some(week => week.label === 'Mar 29-Apr 4' && week.linesChanged === 125)).toBeTrue();
    expect(history[history.length - 1].weekStart).toMatch(/2026-04-/);
  });
});
