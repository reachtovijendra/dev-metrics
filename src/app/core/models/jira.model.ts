// JIRA Cloud API Response Models

export interface JiraSearchResponse {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  expand?: string;
  fields: JiraIssueFields;
  changelog?: JiraChangelog;
}

export interface JiraIssueFields {
  summary: string;
  description?: string;
  issuetype: JiraIssueType;
  status: JiraStatus;
  priority?: JiraPriority;
  assignee?: JiraUser;
  reporter?: JiraUser;
  creator?: JiraUser;
  created: string;
  updated: string;
  resolutiondate?: string;
  resolution?: JiraResolution;
  labels?: string[];
  components?: JiraComponent[];
  project: JiraProject;
  customfield_10016?: number; // Story points (common custom field)
  parent?: { key: string; fields: { summary: string; issuetype: JiraIssueType } };
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  subtask: boolean;
  iconUrl?: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  description?: string;
  statusCategory: JiraStatusCategory;
}

export interface JiraStatusCategory {
  id: number;
  key: string;
  name: string;
  colorName: string;
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl?: string;
}

export interface JiraUser {
  accountId: string;
  emailAddress?: string;
  displayName: string;
  active: boolean;
  avatarUrls?: {
    '48x48': string;
    '24x24': string;
    '16x16': string;
    '32x32': string;
  };
}

export interface JiraResolution {
  id: string;
  name: string;
  description?: string;
}

export interface JiraComponent {
  id: string;
  name: string;
  description?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  avatarUrls?: {
    '48x48': string;
    '24x24': string;
    '16x16': string;
    '32x32': string;
  };
}

export interface JiraChangelog {
  startAt: number;
  maxResults: number;
  total: number;
  histories: JiraChangeHistory[];
}

export interface JiraChangeHistory {
  id: string;
  author: JiraUser;
  created: string;
  items: JiraChangeItem[];
}

export interface JiraChangeItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}

export interface JiraAggregatedMetrics {
  userId: string;
  displayName: string;
  email?: string;
  ticketsDevDone: number;
  ticketsQaDone: number;
  defectsInjected: number;
  defectsFixed: number;
  totalTicketsAssigned: number;
  avgResolutionTimeHours: number;
  ticketsInProgress: number;
  ticketsBlocked: number;
}





