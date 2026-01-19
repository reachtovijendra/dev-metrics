export interface BitbucketCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface CursorCredentials {
  apiKey: string;
}

export interface JiraCredentials {
  domain: string;
  email: string;
  apiToken: string;
}

export interface AllCredentials {
  bitbucket?: BitbucketCredentials;
  cursor?: CursorCredentials;
  jira?: JiraCredentials;
}



