export interface MablTestRun {
  application_id: string;
  application_name: string;
  environment_id: string;
  environment_name: string;
  initial_url: string;
  scenario_name: string;
  browser: string;
  browser_version: string;
  execution_runner_type: string;
  plan_id: string;
  plan_name: string;
  plan_run_id: string;
  test_id: string;
  test_version: string;
  test_name: string;
  test_type: string;
  branch: string;
  test_run_id: string;
  test_run_app_url: string;
  is_ad_hoc_run: boolean;
  failure_category: string;
  start_time: number;
  end_time: number;
  run_time: number;
  status: string;
  success: boolean;
  trigger_type: string;
  triggering_deployment_event_id: string;
  emulation_mode: string;
  metrics?: MablTestMetrics;
}

export interface MablTestMetrics {
  cumulative_speed_index?: number;
  cumulative_api_response_time?: number;
  accessibility_rule_violations?: MablAccessibilityViolations;
}

export interface MablAccessibilityViolations {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

export interface MablTestRunsResponse {
  test_results: MablTestRun[];
  cursor?: string;
  summary?: MablTestRunsSummary;
}

export interface MablTestRunsSummary {
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
}

export interface MablApplication {
  id: string;
  name: string;
  workspace_id: string;
  created_time: number;
  description?: string;
}

export interface MablApplicationsResponse {
  applications: MablApplication[];
}

export interface MablEnvironment {
  id: string;
  name: string;
  workspace_id: string;
  created_time: number;
  default_url?: string;
}

export interface MablEnvironmentsResponse {
  environments: MablEnvironment[];
}

export interface MablActivityEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  user_email: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  created_time: number;
  details?: Record<string, unknown>;
}

export interface MablActivityResponse {
  activity_entries: MablActivityEntry[];
  cursor?: string;
}

export interface MablDeploymentResult {
  event_id: string;
  workspace_id: string;
  application_id: string;
  environment_id: string;
  status: string;
  plan_execution_results: MablPlanExecutionResult[];
  created_time: number;
  completed_time?: number;
}

export interface MablPlanExecutionResult {
  plan_id: string;
  plan_name: string;
  status: string;
  journey_execution_results: MablJourneyExecutionResult[];
}

export interface MablJourneyExecutionResult {
  journey_id: string;
  journey_name: string;
  status: string;
  test_run_id: string;
}

export interface MablAggregatedMetrics {
  totalTestRuns: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
  failRate: number;
  averageRunTime: number;
  totalRunTime: number;
  testsByApplication: Record<string, number>;
  testsByEnvironment: Record<string, number>;
  testsByBrowser: Record<string, number>;
  testsByStatus: Record<string, number>;
  failureCategories: Record<string, number>;
  accessibilityViolations: MablAccessibilityViolations;
  performanceMetrics: {
    avgSpeedIndex: number;
    avgApiResponseTime: number;
  };
  dailyTrends: MablDailyTrend[];
}

export interface MablDailyTrend {
  date: string;
  totalRuns: number;
  passed: number;
  failed: number;
  passRate: number;
  avgRunTime: number;
}

export interface MablTestRunQuery {
  workspaceId: string;
  earliestRunStartTime?: number;
  latestRunStartTime?: number;
  testId?: string;
  planId?: string;
  applicationId?: string;
  environmentId?: string;
  labels?: string[];
  advancedMetrics?: boolean;
  limit?: number;
  cursor?: string;
}

export interface MablDeveloperMetrics {
  testsCreated: number;
  testsModified: number;
  testMaintenanceActivity: number;
  testsOwned: number;
  ownedTestsPassRate: number;
  activityScore: number;
  lastActivityDate?: Date;
}
