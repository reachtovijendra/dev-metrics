export interface GithubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GithubSearchItem[];
}

export interface GithubSearchItem {
  id: number;
  number: number;
  repository_url: string;
  html_url: string;
  user: GithubUser | null;
  created_at: string;
  state: 'open' | 'closed';
  pull_request?: {
    url: string;
    html_url: string;
    merged_at: string | null;
  };
}

export interface GithubUser {
  login: string;
  avatar_url?: string;
}

export interface GithubPullRequestDetail {
  number: number;
  additions: number;
  deletions: number;
  changed_files: number;
  merged_at: string | null;
}

export interface GithubPullRequestReview {
  id: number;
  user: GithubUser | null;
  state: string;
  submitted_at: string | null;
}
