export interface Developer {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl?: string;
}

export interface DeveloperMetrics {
  developer: Developer;
  bitbucket?: BitbucketMetrics;
  cursor?: CursorMetrics;
  jira?: JiraMetrics;
}

export interface BitbucketMetrics {
  linesAdded: number;
  linesRemoved: number;
  prsSubmitted: number;
  prsReviewed: number;
  prCommentsAdded: number;
  prCommentsReceived: number;
  commits: number;
  avgPrSize: number;
  mergedPrs: number;
  openPrs: number;
}

export interface CursorMetrics {
  totalLinesGenerated: number;
  acceptedLinesAdded: number;
  totalTabsShown: number;
  totalTabsAccepted: number;
  tabAcceptanceRate: number;
  totalRequests: number;
  spendingUsd: number;
  activeDays: number;
}

export interface JiraMetrics {
  ticketsDevDone: number;
  ticketsQaDone: number;
  defectsInjected: number;
  defectsFixed: number;
  totalTicketsAssigned: number;
  avgResolutionTimeHours: number;
  ticketsInProgress: number;
  ticketsBlocked: number;
}

export interface MetricsSummary {
  totalDevelopers: number;
  totalLinesOfCode: number;
  totalPrs: number;
  totalPrsReviewed: number;
  totalCommits: number;
  totalAiLinesGenerated: number;
  totalAiLinesAccepted: number;
  totalTicketsCompleted: number;
  totalDefectsFixed: number;
  dateRange: DateRange;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}





