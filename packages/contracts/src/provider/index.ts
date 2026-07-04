import type {
  CapabilityDescriptor,
  CapabilityMap,
  BranchesCapability,
  FilesCapability,
  HistoryCapability,
  IssuesCapability,
  PullRequestsCapability,
  ReleasesCapability,
  SearchCapability,
  TagsCapability,
  TreeCapability
} from "../capabilities/index.js";
import type { AuthenticationContext, AuthenticationStrategy } from "../authentication/index.js";
import type { RepositoryIdentity, RepositoryInfo } from "../domain/index.js";
import type { Metadata, ProviderId, RepositoryUrl } from "../metadata/index.js";
import type { DeepReadonly, OperationOptions } from "../types/index.js";

export type ProviderLifecycleState = "registered" | "resolved" | "active" | "disposed";

export type ProviderInfo = DeepReadonly<{
  id: ProviderId;
  name: string;
  version?: string;
  priority?: number;
  capabilities: CapabilityMap;
  metadata?: Metadata;
}>;

export type RepositoryLocator = DeepReadonly<{
  url: RepositoryUrl;
}>;

export type ProviderMatch = DeepReadonly<{
  provider: ProviderId;
  confidence: "exact" | "probable" | "none";
  repository?: RepositoryIdentity;
  metadata?: Metadata;
}>;

export type ProviderContext = DeepReadonly<{
  provider: ProviderInfo;
  authentication?: AuthenticationStrategy;
  authenticationContext?: AuthenticationContext;
  metadata?: Metadata;
}>;

export type CreateSessionRequest = OperationOptions &
  DeepReadonly<{
    repository: RepositoryLocator | RepositoryIdentity;
    context: ProviderContext;
  }>;

export type ProviderSessionCapabilities = DeepReadonly<{
  files: FilesCapability;
  tree: TreeCapability;
  history: HistoryCapability;
  search: SearchCapability;
  branches?: BranchesCapability;
  tags?: TagsCapability;
  releases?: ReleasesCapability;
  issues?: IssuesCapability;
  pullRequests?: PullRequestsCapability;
}>;

export interface Provider {
  readonly info: ProviderInfo;
  supports(locator: RepositoryLocator): Promise<ProviderMatch>;
  createSession(request: CreateSessionRequest): Promise<ProviderSession>;
}

export interface ProviderSession {
  readonly provider: ProviderInfo;
  readonly repository: RepositoryInfo;
  readonly capabilities: ProviderSessionCapabilities;
  readonly state: ProviderLifecycleState;
  getCapabilities(): Promise<readonly CapabilityDescriptor[]>;
  dispose(): Promise<void>;
}
