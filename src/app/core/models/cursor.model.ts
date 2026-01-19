// Cursor Admin API Response Models

export interface CursorTeamMember {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  createdAt: string;
  lastActiveAt?: string;
}

export interface CursorDailyUsageRequest {
  startDate: string;
  endDate: string;
}

export interface CursorDailyUsageResponse {
  data: CursorUserDailyUsage[];
}

export interface CursorUserDailyUsage {
  userId: string;
  email: string;
  name: string;
  date: string;
  metrics: CursorDailyMetrics;
}

export interface CursorDailyMetrics {
  totalLinesAdded: number;
  totalLinesDeleted: number;
  acceptedLinesAdded: number;
  acceptedLinesDeleted: number;
  totalTabsShown: number;
  totalTabsAccepted: number;
  totalComposerRequests: number;
  totalChatRequests: number;
  totalAgentRequests: number;
  usageBasedRequests: number;
  subscriptionIncludedRequests: number;
}

export interface CursorTeamAnalytics {
  totalMembers: number;
  activeMembers: number;
  totalRequests: number;
  usageBasedRequests: number;
  estimatedSpend: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface CursorAggregatedMetrics {
  userId: string;
  email: string;
  name: string;
  totalLinesGenerated: number;
  acceptedLinesAdded: number;
  totalTabsShown: number;
  totalTabsAccepted: number;
  tabAcceptanceRate: number;
  totalRequests: number;
  spendingUsd: number;
  activeDays: number;
}


