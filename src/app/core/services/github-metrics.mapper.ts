export interface ConfiguredGithubDeveloper {
  name: string;
  username: string;
  email: string;
  githubUsername?: string;
  manager?: string;
  department?: string;
  innovationTeam?: string;
}

export interface GithubMetricPullRequest {
  key: string;
  repo: string;
  number: number;
  authorLogin: string;
  createdAt: string;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewLogins: string[];
}

export interface DeveloperGithubMetrics {
  name: string;
  email: string;
  username: string;
  githubUsername: string;
  prsSubmitted: number;
  prsReviewed: number;
  prsMerged: number;
  openPrs: number;
  uniqueRepositories: number;
  repositories: string[];
  authoredPullRequests: GithubMetricPullRequest[];
  reviewedPullRequests: GithubMetricPullRequest[];
  activityPullRequests: GithubMetricPullRequest[];
  linesAdded: number;
  linesRemoved: number;
  avgPrSize: number;
  changedFiles: number;
  activityScore: number;
  manager: string;
  department: string;
  innovationTeam: string;
}

export interface GithubMetricsSummary {
  totalPrs: number;
  prsReviewed: number;
  prsMerged: number;
  openPrs: number;
  uniqueRepositories: number;
  linesAdded: number;
  linesRemoved: number;
  changedFiles: number;
}

export interface GithubRepositoryActivity {
  repo: string;
  activityCount: number;
}

export interface GithubWeeklyActivity {
  label: string;
  prsSubmitted: number;
  prsMerged: number;
}

export interface GithubRepositoryBreakdown {
  repo: string;
  activityCount: number;
  prsSubmitted: number;
  prsReviewed: number;
  lineChanges: number;
  changedFiles: number;
}

export interface GithubWeeklyLineChanges {
  label: string;
  weekStart: string;
  additions: number;
  deletions: number;
  linesChanged: number;
  prsSubmitted: number;
}

export interface GithubMetricsResult {
  developers: DeveloperGithubMetrics[];
  summary: GithubMetricsSummary;
  topRepositories: GithubRepositoryActivity[];
  weeklyActivity: GithubWeeklyActivity[];
}

function resolveGithubUsername(developer: ConfiguredGithubDeveloper): string {
  return (developer.githubUsername || developer.username).trim();
}

function weekLabel(date: Date): string {
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - oneJan.getTime()) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + oneJan.getDay()) / 7);
  return `Week ${week}`;
}

export function uniquePullRequests(pullRequests: (GithubMetricPullRequest | null | undefined)[]): GithubMetricPullRequest[] {
  const byKey = new Map<string, GithubMetricPullRequest>();
  for (const pr of pullRequests) {
    if (pr) {
      byKey.set(pr.key, pr);
    }
  }
  return Array.from(byKey.values());
}

export function getTopRepositories(pullRequests: (GithubMetricPullRequest | null | undefined)[]): GithubRepositoryActivity[] {
  const repoActivity = new Map<string, number>();
  for (const pr of uniquePullRequests(pullRequests)) {
    repoActivity.set(pr.repo, (repoActivity.get(pr.repo) || 0) + 1);
  }
  return Array.from(repoActivity.entries())
    .map(([repo, activityCount]) => ({ repo, activityCount }))
    .sort((a, b) => b.activityCount - a.activityCount || a.repo.localeCompare(b.repo))
    .slice(0, 8);
}

export function getWeeklyActivity(pullRequests: (GithubMetricPullRequest | null | undefined)[]): GithubWeeklyActivity[] {
  const weeklyMap = new Map<string, GithubWeeklyActivity>();
  for (const pr of uniquePullRequests(pullRequests)) {
    const label = weekLabel(new Date(pr.createdAt));
    const current = weeklyMap.get(label) || { label, prsSubmitted: 0, prsMerged: 0 };
    current.prsSubmitted += 1;
    current.prsMerged += pr.mergedAt ? 1 : 0;
    weeklyMap.set(label, current);
  }
  return Array.from(weeklyMap.values());
}

export function getDeveloperRepositoryBreakdown(
  pullRequests: (GithubMetricPullRequest | null | undefined)[],
  githubUsername = ''
): GithubRepositoryBreakdown[] {
  const repoMap = new Map<string, GithubRepositoryBreakdown>();
  const normalizedLogin = githubUsername.toLowerCase();

  for (const pr of uniquePullRequests(pullRequests)) {
    const isAuthored = !normalizedLogin || pr.authorLogin.toLowerCase() === normalizedLogin;
    const isReviewed = !!normalizedLogin && pr.reviewLogins.some(login => login.toLowerCase() === normalizedLogin);
    const current = repoMap.get(pr.repo) || {
      repo: pr.repo,
      activityCount: 0,
      prsSubmitted: 0,
      prsReviewed: 0,
      lineChanges: 0,
      changedFiles: 0
    };

    current.activityCount += 1;
    current.prsSubmitted += isAuthored ? 1 : 0;
    current.prsReviewed += isReviewed ? 1 : 0;
    current.lineChanges += isAuthored ? pr.additions + pr.deletions : 0;
    current.changedFiles += isAuthored ? pr.changedFiles : 0;
    repoMap.set(pr.repo, current);
  }

  return Array.from(repoMap.values())
    .sort((a, b) => b.lineChanges - a.lineChanges || b.activityCount - a.activityCount || a.repo.localeCompare(b.repo));
}

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();

  return startMonth === endMonth
    ? `${startMonth} ${startDay}-${endDay}`
    : `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

export function getWeeklyLineChanges(
  pullRequests: (GithubMetricPullRequest | null | undefined)[],
  referenceDate = new Date(),
  monthsBack = 6
): GithubWeeklyLineChanges[] {
  const rangeEnd = startOfWeek(referenceDate);
  const rangeStart = startOfWeek(new Date(referenceDate));
  rangeStart.setMonth(rangeStart.getMonth() - monthsBack);

  const weekMap = new Map<string, GithubWeeklyLineChanges>();
  for (const cursor = new Date(rangeStart); cursor <= rangeEnd; cursor.setDate(cursor.getDate() + 7)) {
    const weekStart = formatIsoDate(cursor);
    weekMap.set(weekStart, {
      label: formatWeekRangeLabel(cursor),
      weekStart,
      additions: 0,
      deletions: 0,
      linesChanged: 0,
      prsSubmitted: 0
    });
  }

  for (const pr of uniquePullRequests(pullRequests)) {
    const createdWeek = startOfWeek(new Date(pr.createdAt));
    const key = formatIsoDate(createdWeek);
    const current = weekMap.get(key);

    if (!current) {
      continue;
    }

    current.additions += pr.additions;
    current.deletions += pr.deletions;
    current.linesChanged += pr.additions + pr.deletions;
    current.prsSubmitted += 1;
  }

  return Array.from(weekMap.values());
}

export function sortDevelopersByLineChanges<T extends { linesAdded: number; linesRemoved: number }>(developers: T[]): T[] {
  return [...developers].sort((a, b) => {
    const bLines = b.linesAdded + b.linesRemoved;
    const aLines = a.linesAdded + a.linesRemoved;
    return bLines - aLines;
  });
}

export function buildGithubMetrics(
  developers: ConfiguredGithubDeveloper[],
  pullRequests: GithubMetricPullRequest[]
): GithubMetricsResult {
  const developerRows = developers.map(developer => {
    const githubUsername = resolveGithubUsername(developer);
    const normalizedLogin = githubUsername.toLowerCase();

    const authored = pullRequests.filter(pr => pr.authorLogin.toLowerCase() === normalizedLogin);
    const reviewed = pullRequests.filter(pr =>
      pr.reviewLogins.some(login => login.toLowerCase() === normalizedLogin)
    );
    const activityPullRequests = uniquePullRequests([...authored, ...reviewed]);
    const touchedRepos = new Set(activityPullRequests.map(pr => pr.repo));
    const lineChanges = authored.reduce(
      (acc, pr) => ({
        additions: acc.additions + pr.additions,
        deletions: acc.deletions + pr.deletions,
        changedFiles: acc.changedFiles + pr.changedFiles
      }),
      { additions: 0, deletions: 0, changedFiles: 0 }
    );
    const totalLineChanges = lineChanges.additions + lineChanges.deletions;

    return {
      name: developer.name,
      email: developer.email,
      username: developer.username,
      githubUsername,
      prsSubmitted: authored.length,
      prsReviewed: reviewed.length,
      prsMerged: authored.filter(pr => pr.mergedAt).length,
      openPrs: authored.filter(pr => !pr.mergedAt).length,
      uniqueRepositories: touchedRepos.size,
      repositories: Array.from(touchedRepos),
      authoredPullRequests: authored,
      reviewedPullRequests: reviewed,
      activityPullRequests,
      linesAdded: lineChanges.additions,
      linesRemoved: lineChanges.deletions,
      avgPrSize: authored.length > 0 ? Math.round(totalLineChanges / authored.length) : 0,
      changedFiles: lineChanges.changedFiles,
      activityScore: 0,
      manager: developer.manager || '',
      department: developer.department || '',
      innovationTeam: developer.innovationTeam || ''
    };
  });

  const maxActivity = Math.max(
    0,
    ...developerRows.map(row => row.prsSubmitted + row.prsReviewed + row.uniqueRepositories)
  );

  const developersWithActivity = developerRows.map(row => ({
    ...row,
    activityScore:
      maxActivity > 0
        ? Math.round(((row.prsSubmitted + row.prsReviewed + row.uniqueRepositories) / maxActivity) * 100)
        : 0
  }));

  const summary = developersWithActivity.reduce<GithubMetricsSummary>(
    (acc, row) => ({
      totalPrs: acc.totalPrs + row.prsSubmitted,
      prsReviewed: acc.prsReviewed + row.prsReviewed,
      prsMerged: acc.prsMerged + row.prsMerged,
      openPrs: acc.openPrs + row.openPrs,
      uniqueRepositories: acc.uniqueRepositories,
      linesAdded: acc.linesAdded + row.linesAdded,
      linesRemoved: acc.linesRemoved + row.linesRemoved,
      changedFiles: acc.changedFiles + row.changedFiles
    }),
    {
      totalPrs: 0,
      prsReviewed: 0,
      prsMerged: 0,
      openPrs: 0,
      uniqueRepositories: 0,
      linesAdded: 0,
      linesRemoved: 0,
      changedFiles: 0
    }
  );
  summary.uniqueRepositories = new Set(pullRequests.map(pr => pr.repo)).size;

  return {
    developers: sortDevelopersByLineChanges(developersWithActivity),
    summary,
    topRepositories: getTopRepositories(pullRequests),
    weeklyActivity: getWeeklyActivity(pullRequests)
  };
}
