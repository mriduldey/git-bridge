import type {
  Blob,
  Branch,
  BranchFilter,
  Commit,
  CommitFilter,
  FileInfo,
  Issue,
  IssueFilter,
  PullRequest,
  PullRequestFilter,
  Reference,
  Release,
  ReleaseFilter,
  RepositoryIdentity,
  RepositoryInfo,
  Tag,
  Tree,
  TreeNode
} from "../domain/index.js";
import type { FilePath, ReferenceName, TagName } from "../metadata/index.js";
import type { ListOptions, PagedResult } from "../pagination/index.js";
import type { DeepReadonly, JsonValue, OperationOptions } from "../types/index.js";

export type CapabilityStatus = "supported" | "unsupported" | "partial";

export type CapabilityDescriptor = DeepReadonly<{
  name: string;
  status: CapabilityStatus;
  version?: string;
  operations?: readonly string[];
  limitations?: readonly string[];
}>;

export type CapabilityMap = DeepReadonly<{
  files?: CapabilityDescriptor;
  tree?: CapabilityDescriptor;
  history?: CapabilityDescriptor;
  search?: CapabilityDescriptor;
  branches?: CapabilityDescriptor;
  tags?: CapabilityDescriptor;
  releases?: CapabilityDescriptor;
  issues?: CapabilityDescriptor;
  pullRequests?: CapabilityDescriptor;
}>;

export type ReadFileOptions = OperationOptions &
  DeepReadonly<{
    encoding?: "utf-8";
  }>;

export type ReadBinaryOptions = OperationOptions;

export type DownloadOptions = OperationOptions;

export type StreamOptions = OperationOptions;

export type TreeListOptions = OperationOptions &
  DeepReadonly<{
    recursive?: boolean;
  }>;

export type TreeWalkOptions = TreeListOptions;

export type TextSearchOptions = OperationOptions &
  DeepReadonly<{
    caseSensitive?: boolean;
    regex?: boolean;
    limit?: number;
    path?: FilePath;
  }>;

export type SearchQuery = TextSearchOptions &
  DeepReadonly<{
    text: string;
  }>;

export type SearchMatch = DeepReadonly<{
  lineNumber: number;
  text: string;
  before?: readonly string[];
  after?: readonly string[];
}>;

export type SearchResultKind = "file" | "commit" | "issue" | "pull-request" | "release";

export type SearchResult<TItem = FileInfo> = DeepReadonly<{
  kind: SearchResultKind;
  item: TItem;
  score?: number;
  matches?: readonly SearchMatch[];
}>;

export type FileHistoryOptions = ListOptions<"date">;
export type CommitListOptions = ListOptions<"date"> &
  DeepReadonly<{
    filter?: CommitFilter;
  }>;
export type BranchListOptions = ListOptions<"name"> &
  DeepReadonly<{
    filter?: BranchFilter;
  }>;
export type TagListOptions = ListOptions<"name" | "date">;
export type ReleaseListOptions = ListOptions<"date" | "name"> &
  DeepReadonly<{
    filter?: ReleaseFilter;
  }>;
export type IssueListOptions = ListOptions<"date" | "number"> &
  DeepReadonly<{
    filter?: IssueFilter;
  }>;
export type PullRequestListOptions = ListOptions<"date" | "number"> &
  DeepReadonly<{
    filter?: PullRequestFilter;
  }>;

export interface FilesCapability {
  readText(path: FilePath, options?: ReadFileOptions): Promise<string>;
  readJson<TValue extends JsonValue = JsonValue>(
    path: FilePath,
    options?: ReadFileOptions
  ): Promise<TValue>;
  readBinary(path: FilePath, options?: ReadBinaryOptions): Promise<Uint8Array>;
  download(path: FilePath, options?: DownloadOptions): Promise<Blob>;
  stream(path: FilePath, options?: StreamOptions): Promise<AsyncIterable<Uint8Array>>;
  exists(path: FilePath, options?: OperationOptions): Promise<boolean>;
  metadata(path: FilePath, options?: OperationOptions): Promise<FileInfo>;
}

export interface TreeCapability {
  list(path?: FilePath, options?: TreeListOptions): Promise<readonly TreeNode[]>;
  walk(options?: TreeWalkOptions): AsyncIterable<TreeNode>;
  get(path: FilePath, options?: OperationOptions): Promise<TreeNode>;
  tree(path?: FilePath, options?: TreeListOptions): Promise<Tree>;
}

export interface SearchCapability {
  text(query: string, options?: TextSearchOptions): Promise<PagedResult<SearchResult<FileInfo>>>;
  query<TItem = FileInfo>(query: SearchQuery): Promise<PagedResult<SearchResult<TItem>>>;
}

export interface HistoryCapability {
  list(options?: CommitListOptions): Promise<PagedResult<Commit>>;
  get(sha: string, options?: OperationOptions): Promise<Commit>;
  file(path: FilePath, options?: FileHistoryOptions): Promise<PagedResult<Commit>>;
}

export interface BranchesCapability {
  list(options?: BranchListOptions): Promise<PagedResult<Branch>>;
  get(name: string, options?: OperationOptions): Promise<Branch>;
}

export interface TagsCapability {
  list(options?: TagListOptions): Promise<PagedResult<Tag>>;
  get(name: TagName, options?: OperationOptions): Promise<Tag>;
}

export interface ReleasesCapability {
  list(options?: ReleaseListOptions): Promise<PagedResult<Release>>;
  get(tagName: TagName, options?: OperationOptions): Promise<Release>;
}

export interface IssuesCapability {
  list(options?: IssueListOptions): Promise<PagedResult<Issue>>;
  get(number: number, options?: OperationOptions): Promise<Issue>;
}

export interface PullRequestsCapability {
  list(options?: PullRequestListOptions): Promise<PagedResult<PullRequest>>;
  get(number: number, options?: OperationOptions): Promise<PullRequest>;
}

export interface Repository {
  readonly identity: RepositoryIdentity;
  readonly info: RepositoryInfo;
  readonly capabilities: CapabilityMap;
  readonly extensions: Readonly<Record<string, unknown>>;
  ref(reference: ReferenceName | Reference): RepositoryRef;
  dispose(): Promise<void>;
}

export interface RepositoryRef {
  readonly repository: RepositoryIdentity;
  readonly reference: Reference;
  readonly files: FilesCapability;
  readonly tree: TreeCapability;
  readonly history: HistoryCapability;
  readonly search: SearchCapability;
  readonly branches: BranchesCapability;
  readonly tags: TagsCapability;
  readonly releases: ReleasesCapability;
  readonly issues?: IssuesCapability;
  readonly pullRequests?: PullRequestsCapability;
  readme(options?: OperationOptions): Promise<string>;
}
