// Bitbucket Data Center API Response Models

export interface BitbucketPagedResponse<T> {
  size: number;
  limit: number;
  start: number;
  isLastPage: boolean;
  values: T[];
  nextPageStart?: number;
}

export interface BitbucketProject {
  key: string;
  id: number;
  name: string;
  description?: string;
  public: boolean;
  type: string;
  links: BitbucketLinks;
}

export interface BitbucketRepository {
  slug: string;
  id: number;
  name: string;
  description?: string;
  state: string;
  forkable: boolean;
  project: BitbucketProject;
  public: boolean;
  links: BitbucketLinks;
}

export interface BitbucketUser {
  name: string;
  emailAddress: string;
  id: number;
  displayName: string;
  active: boolean;
  slug: string;
  type: string;
  links?: BitbucketLinks;
}

export interface BitbucketPullRequest {
  id: number;
  version: number;
  title: string;
  description?: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED';
  open: boolean;
  closed: boolean;
  createdDate: number;
  updatedDate: number;
  closedDate?: number;
  fromRef: BitbucketRef;
  toRef: BitbucketRef;
  locked: boolean;
  author: BitbucketParticipant;
  reviewers: BitbucketParticipant[];
  participants: BitbucketParticipant[];
  links: BitbucketLinks;
}

export interface BitbucketRef {
  id: string;
  displayId: string;
  latestCommit: string;
  repository: BitbucketRepository;
}

export interface BitbucketParticipant {
  user: BitbucketUser;
  role: 'AUTHOR' | 'REVIEWER' | 'PARTICIPANT';
  approved: boolean;
  status: 'UNAPPROVED' | 'APPROVED' | 'NEEDS_WORK';
}

export interface BitbucketCommit {
  id: string;
  displayId: string;
  author: BitbucketAuthor;
  authorTimestamp: number;
  committer: BitbucketAuthor;
  committerTimestamp: number;
  message: string;
  parents: { id: string; displayId: string }[];
}

export interface BitbucketAuthor {
  name: string;
  emailAddress: string;
}

export interface BitbucketActivity {
  id: number;
  createdDate: number;
  user: BitbucketUser;
  action: 'COMMENTED' | 'APPROVED' | 'REVIEWED' | 'OPENED' | 'MERGED' | 'DECLINED' | 'UPDATED';
  commentAction?: 'ADDED' | 'EDITED' | 'DELETED';
  comment?: BitbucketComment;
}

export interface BitbucketComment {
  id: number;
  version: number;
  text: string;
  author: BitbucketUser;
  createdDate: number;
  updatedDate: number;
  comments?: BitbucketComment[];
  severity?: string;
  state?: string;
}

export interface BitbucketDiff {
  diffs: BitbucketFileDiff[];
  truncated: boolean;
}

export interface BitbucketFileDiff {
  source?: { toString: string };
  destination?: { toString: string };
  hunks: BitbucketHunk[];
  truncated: boolean;
}

export interface BitbucketHunk {
  sourceLine: number;
  sourceSpan: number;
  destinationLine: number;
  destinationSpan: number;
  segments: BitbucketSegment[];
  truncated: boolean;
}

export interface BitbucketSegment {
  type: 'ADDED' | 'REMOVED' | 'CONTEXT';
  lines: { line: number; source: number; destination: number }[];
  truncated: boolean;
}

export interface BitbucketLinks {
  self?: { href: string }[];
  clone?: { href: string; name: string }[];
}

// PR Changes/Diff Stats
export interface BitbucketPRChange {
  contentId: string;
  fromContentId?: string;
  path: {
    toString: string;
    components: string[];
    name: string;
    extension?: string;
  };
  executable: boolean;
  percentUnchanged: number;
  type: 'ADD' | 'DELETE' | 'MODIFY' | 'MOVE' | 'COPY';
  nodeType: 'FILE' | 'DIRECTORY';
  srcPath?: {
    toString: string;
  };
  properties?: {
    gitChangeType?: string;
  };
}

export interface BitbucketDiffStats {
  linesAdded: number;
  linesRemoved: number;
}

