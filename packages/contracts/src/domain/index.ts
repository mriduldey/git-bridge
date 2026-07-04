import type {
  BlobSha,
  BranchName,
  CommitSha,
  DateRange,
  FilePath,
  IssueId,
  Metadata,
  OrganizationId,
  OrganizationName,
  OwnerName,
  ProviderId,
  PullRequestId,
  ReleaseId,
  RepositoryName,
  RepositoryUrl,
  TagName,
  Timestamp,
  TreeSha,
  UserId
} from "../metadata/index.js";
import type { DeepReadonly, JsonValue } from "../types/index.js";

export type RepositoryVisibility = "public" | "private" | "internal" | "unknown";
export type RepositoryOwnerType = "user" | "organization" | "unknown";
export type ReferenceType = "branch" | "tag" | "commit" | "pull-request" | "detached";
export type TreeNodeType = "file" | "directory" | "symlink" | "submodule";
export type BlobEncoding = "utf-8" | "base64" | "binary";
export type CommitVerificationStatus = "verified" | "unverified" | "unknown";
export type PullRequestState = "open" | "closed" | "merged";
export type IssueState = "open" | "closed";
export type ReleaseState = "draft" | "prerelease" | "published";
export type MergeStatus = "clean" | "dirty" | "blocked" | "unknown";

export type User = DeepReadonly<{
  id?: UserId;
  username: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  url?: string;
  metadata?: Metadata;
}>;

export type Organization = DeepReadonly<{
  id?: OrganizationId;
  name: OrganizationName;
  displayName?: string;
  description?: string;
  avatarUrl?: string;
  url?: string;
  metadata?: Metadata;
}>;

export type RepositoryOwner = User | Organization;

export type License = DeepReadonly<{
  key: string;
  name: string;
  spdxId?: string;
  url?: string;
}>;

export type RepositoryIdentity = DeepReadonly<{
  provider: ProviderId;
  owner: OwnerName;
  name: RepositoryName;
}>;

export type RepositoryInfo = DeepReadonly<{
  identity: RepositoryIdentity;
  name: RepositoryName;
  fullName: string;
  owner: RepositoryOwner;
  url: RepositoryUrl;
  defaultBranch?: BranchName;
  description?: string;
  visibility: RepositoryVisibility;
  isArchived?: boolean;
  isFork?: boolean;
  license?: License;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  metadata?: Metadata;
}>;

export type Workspace = DeepReadonly<{
  provider: ProviderId;
  name: string;
  owner?: RepositoryOwner;
  repositoriesUrl?: string;
  metadata?: Metadata;
}>;

export type Reference = DeepReadonly<{
  name: string;
  type: ReferenceType;
  target: CommitSha;
  repository: RepositoryIdentity;
  metadata?: Metadata;
}>;

export type Branch = Reference &
  DeepReadonly<{
    type: "branch";
    name: BranchName;
    protected?: boolean;
    default?: boolean;
  }>;

export type Tag = Reference &
  DeepReadonly<{
    type: "tag";
    name: TagName;
    message?: string;
    tagger?: GitActor;
    taggedAt?: Timestamp;
  }>;

export type GitActor = DeepReadonly<{
  name: string;
  email?: string;
  date?: Timestamp;
  user?: User;
}>;

export type CommitParent = DeepReadonly<{
  sha: CommitSha;
  url?: string;
}>;

export type CommitVerification = DeepReadonly<{
  status: CommitVerificationStatus;
  reason?: string;
  signature?: string;
}>;

export type Commit = DeepReadonly<{
  sha: CommitSha;
  message: string;
  author: GitActor;
  committer?: GitActor;
  parents: readonly CommitParent[];
  tree: TreeSha;
  url?: string;
  verification?: CommitVerification;
  metadata?: Metadata;
}>;

export type Tree = DeepReadonly<{
  sha: TreeSha;
  path: FilePath;
  nodes: readonly TreeNode[];
  truncated?: boolean;
  metadata?: Metadata;
}>;

export type TreeNode = DeepReadonly<{
  path: FilePath;
  name: string;
  type: TreeNodeType;
  sha?: TreeSha | BlobSha | CommitSha;
  size?: number;
  mode?: string;
  metadata?: Metadata;
}>;

export type Blob = DeepReadonly<{
  sha: BlobSha;
  path: FilePath;
  size: number;
  encoding: BlobEncoding;
  content?: string | Uint8Array;
  metadata?: Metadata;
}>;

export type FileInfo = DeepReadonly<{
  path: FilePath;
  name: string;
  sha?: BlobSha;
  size?: number;
  contentType?: string;
  lastModified?: Timestamp;
  downloadUrl?: string;
  metadata?: Metadata;
}>;

export type ReleaseAsset = DeepReadonly<{
  name: string;
  size?: number;
  contentType?: string;
  downloadUrl?: string;
  createdAt?: Timestamp;
  metadata?: Metadata;
}>;

export type Release = DeepReadonly<{
  id?: ReleaseId;
  tagName: TagName;
  name?: string;
  state: ReleaseState;
  body?: string;
  author?: User;
  createdAt?: Timestamp;
  publishedAt?: Timestamp;
  assets?: readonly ReleaseAsset[];
  metadata?: Metadata;
}>;

export type PullRequestRef = DeepReadonly<{
  repository: RepositoryIdentity;
  branch: BranchName;
  sha?: CommitSha;
}>;

export type PullRequest = DeepReadonly<{
  id?: PullRequestId;
  number: number;
  title: string;
  body?: string;
  state: PullRequestState;
  author?: User;
  source: PullRequestRef;
  target: PullRequestRef;
  mergeStatus?: MergeStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  closedAt?: Timestamp;
  mergedAt?: Timestamp;
  metadata?: Metadata;
}>;

export type Issue = DeepReadonly<{
  id?: IssueId;
  number: number;
  title: string;
  body?: string;
  state: IssueState;
  author?: User;
  labels?: readonly string[];
  assignees?: readonly User[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  closedAt?: Timestamp;
  metadata?: Metadata;
}>;

export type RepositoryFilter = DeepReadonly<{
  owner?: OwnerName;
  visibility?: RepositoryVisibility;
  archived?: boolean;
  fork?: boolean;
  updated?: DateRange;
}>;

export type BranchFilter = DeepReadonly<{
  name?: BranchName;
  protected?: boolean;
}>;

export type CommitFilter = DeepReadonly<{
  author?: string;
  path?: FilePath;
  date?: DateRange;
}>;

export type ReleaseFilter = DeepReadonly<{
  state?: ReleaseState;
  tagName?: TagName;
}>;

export type IssueFilter = DeepReadonly<{
  state?: IssueState;
  author?: string;
  labels?: readonly string[];
}>;

export type PullRequestFilter = DeepReadonly<{
  state?: PullRequestState;
  author?: string;
  target?: BranchName;
  source?: BranchName;
}>;

export type JsonDocument = DeepReadonly<{
  value: JsonValue;
}>;
