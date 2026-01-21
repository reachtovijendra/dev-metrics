// Cursor Admin API Response Models

export interface CursorTeamMember {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'owner' | 'removed';
  isRemoved: boolean;
}

export interface CursorDailyUsageRequest {
  startDate: string;
  endDate: string;
}

export interface CursorDailyUsageResponse {
  period?: {
    startDate: number;
    endDate: number;
  };
  data: CursorUserDailyUsage[];
}

// Actual API response format - metrics are at top level, not nested
export interface CursorUserDailyUsage {
  date: number;  // Unix timestamp
  day: string;   // YYYY-MM-DD format
  userId: string;
  email: string;
  isActive: boolean;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  acceptedLinesAdded: number;
  acceptedLinesDeleted: number;
  totalApplies: number;
  totalAccepts: number;
  totalRejects: number;
  totalTabsShown: number;
  totalTabsAccepted: number;
  composerRequests: number;
  chatRequests: number;
  agentRequests: number;
  cmdkUsages: number;
  subscriptionIncludedReqs: number;
  apiKeyReqs: number;
  usageBasedReqs: number;
  bugbotUsages: number;
  mostUsedModel?: string;
  applyMostUsedExtension?: string;
  tabMostUsedExtension?: string;
  clientVersion?: string;
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
  favoriteModel?: string;
  lastUsedAt?: number; // Unix timestamp (UTC) - last activity
}

// Spending API Models
export interface CursorSpendingRequest {
  searchTerm?: string;
  sortBy?: 'amount' | 'date' | 'user';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface CursorTeamMemberSpend {
  userId: string;
  spendCents: number;
  overallSpendCents: number;  // This is the actual monthly usage value
  fastPremiumRequests: number;
  name: string;
  email: string;
  role: 'admin' | 'member' | 'owner' | 'removed';
  hardLimitOverrideDollars: number;
}

export interface CursorSpendingResponse {
  teamMemberSpend: CursorTeamMemberSpend[];
  subscriptionCycleStart: number;
  totalMembers: number;
  totalPages: number;
}


