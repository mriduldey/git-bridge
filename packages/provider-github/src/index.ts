import {
  anonymousAuth,
  createAuthContext,
  tokenAuth,
  type AuthenticationRequest,
  type AuthenticationStrategy,
  type StaticTokenAuthConfig
} from "@gitbridge/auth";
import type { CacheProvider } from "@gitbridge/cache";
import type {
  AuthenticationContext,
  Blob,
  Branch,
  BranchListOptions,
  BranchesCapability,
  CapabilityDescriptor,
  CapabilityMap,
  Commit,
  CommitListOptions,
  CreateSessionRequest,
  FilePath,
  FileHistoryOptions,
  FileInfo,
  HistoryCapability,
  Issue,
  IssueListOptions,
  IssuesCapability,
  JsonValue,
  Metadata,
  Provider,
  ProviderContext,
  ProviderInfo,
  ProviderMatch,
  ProviderSession,
  ProviderSessionCapabilities,
  PullRequest,
  PullRequestListOptions,
  PullRequestsCapability,
  Release,
  ReleaseListOptions,
  ReleasesCapability,
  RepositoryIdentity,
  RepositoryInfo,
  RepositoryLocator,
  SearchCapability,
  SearchQuery,
  SearchResult,
  Tag,
  TagListOptions,
  TagName,
  TagsCapability,
  Transport,
  TransportRequest,
  TransportResponse,
  Tree,
  TreeCapability
} from "@gitbridge/contracts";
import type { FilesCapability } from "@gitbridge/contracts/capabilities";
import type { PagedResult } from "@gitbridge/contracts/pagination";
import {
  createGitBridgeClient,
  type GitBridgeClient,
  type GitBridgeClientConfig
} from "@gitbridge/core";
import {
  AuthenticationError,
  AuthorizationError,
  CapabilityNotSupportedError,
  ConflictError,
  GitBridgeError,
  NotFoundError,
  ProviderError,
  RateLimitError,
  TransportError,
  ValidationError,
  type ErrorDiagnostics,
  type ErrorRetryability
} from "@gitbridge/errors";
import type { DiagnosticsService } from "@gitbridge/observability";
import { deepFreeze } from "@gitbridge/shared";
import { createTransportResponse } from "@gitbridge/transport";

import type {
  GitHubBlobModel,
  GitHubBranchModel,
  GitHubCommitModel,
  GitHubContentModel,
  GitHubIssueModel,
  GitHubPullRequestModel,
  GitHubRefModel,
  GitHubReleaseModel,
  GitHubRepositoryModel,
  GitHubSearchResponseModel,
  GitHubTreeModel
} from "./github-models.js";
import {
  mapGitHubBranch,
  mapGitHubCommit,
  mapGitHubContentToBlob,
  mapGitHubContentToFileInfo,
  mapGitHubContentToTreeNode,
  mapGitHubIssue,
  mapGitHubPullRequest,
  mapGitHubRelease,
  mapGitHubRepository,
  mapGitHubSearchItem,
  mapGitHubTag,
  mapGitHubTree
} from "./mappers.js";
export { GitHubProviderId, GitHubProviderName, GitHubProviderVersion } from "./constants.js";
import { GitHubProviderId, GitHubProviderName, GitHubProviderVersion } from "./constants.js";

export type GitHubProviderConfig = Readonly<{
  cache?: CacheProvider;
  diagnostics?: DiagnosticsService;
  hosts?: readonly string[];
  metadata?: Metadata;
  priority?: number;
  transport?: Transport;
}>;

export type GitHubTokenAuthOptions = Readonly<
  Omit<StaticTokenAuthConfig, "kind" | "provider" | "token">
>;

export type GitHubClientConfig = GitHubProviderConfig &
  Readonly<{
    authentication?: AuthenticationStrategy;
    token?: string;
  }>;

type GitHubProviderDependencies = Readonly<{
  cache?: CacheProvider;
  diagnostics?: DiagnosticsService;
  transport: Transport;
}>;

type GitHubRequest = Readonly<{
  body?: TransportRequest["body"];
  headers?: Readonly<Record<string, string>>;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  signal?: AbortSignal;
  timeoutMs?: number;
  url: string;
}>;

type GitHubResponse<TBody = unknown> = Readonly<{
  data?: TBody;
  headers?: Readonly<Record<string, string>>;
  status: number;
}>;

type GitHubDataResponse<TBody = unknown> = Readonly<{
  data?: TBody;
  headers?: Readonly<Record<string, string>>;
  status: number;
}>;

interface GitHubRequestClient {
  request<TBody = unknown>(request: GitHubRequest): Promise<GitHubResponse<TBody>>;
}

type GitHubRequestContext = Readonly<{
  authentication?: AuthenticationContext;
  metadata?: Metadata;
  transport: Transport;
}>;

type GitHubRepositoryLocation = Readonly<{
  host: string;
  name: string;
  owner: string;
  url: string;
}>;

type MutableSessionState = "active" | "disposed";

const foundationCapabilityDescriptors = deepFreeze([
  {
    name: "files",
    operations: [
      "readText",
      "readJson",
      "readBinary",
      "download",
      "exists",
      "metadata",
      "getMetadata"
    ],
    status: "supported"
  },
  {
    name: "tree",
    operations: ["list", "get", "tree"],
    status: "supported"
  },
  {
    name: "history",
    operations: ["list", "get", "file"],
    status: "supported"
  },
  {
    name: "search",
    operations: ["text", "query"],
    status: "supported"
  },
  {
    name: "branches",
    operations: ["list", "get"],
    status: "supported"
  },
  {
    name: "tags",
    operations: ["list", "get"],
    status: "supported"
  },
  {
    name: "issues",
    operations: ["list", "get"],
    status: "supported"
  },
  {
    name: "pullRequests",
    operations: ["list", "get"],
    status: "supported"
  },
  {
    name: "releases",
    operations: ["list", "get"],
    status: "supported"
  }
] satisfies readonly CapabilityDescriptor[]);

export const GitHubProviderCapabilities: CapabilityMap = deepFreeze({
  branches: foundationCapabilityDescriptors[4],
  files: foundationCapabilityDescriptors[0],
  history: foundationCapabilityDescriptors[2],
  issues: foundationCapabilityDescriptors[6],
  pullRequests: foundationCapabilityDescriptors[7],
  releases: foundationCapabilityDescriptors[8],
  search: foundationCapabilityDescriptors[3],
  tags: foundationCapabilityDescriptors[5],
  tree: foundationCapabilityDescriptors[1]
}) as CapabilityMap;

/**
 * Creates the GitHub provider implementation for explicit Core registration.
 */
export function createGitHubProvider(config: GitHubProviderConfig = {}): GitHubProvider {
  return new GitHubProvider(config);
}

/**
 * Creates the GitHub provider with a short, discoverable name for application setup.
 */
export function githubProvider(config: GitHubProviderConfig = {}): GitHubProvider {
  return createGitHubProvider(config);
}

/**
 * Creates a GitBridge client config fragment containing the GitHub provider.
 */
export function createGitHubProviderConfig(
  config: GitHubProviderConfig = {}
): GitBridgeClientConfig {
  return {
    providers: [createGitHubProvider(config)]
  };
}

/**
 * Creates a GitHub-scoped token authentication strategy for GitBridge clients.
 */
export function githubTokenAuth(
  token: string,
  options: GitHubTokenAuthOptions = {}
): AuthenticationStrategy {
  return Object.freeze({
    type: "token",
    async authenticate(request?: AuthenticationRequest) {
      if (request?.provider !== undefined && request.provider !== GitHubProviderId) {
        return createAuthContext(anonymousAuth({ provider: request.provider }));
      }

      return createAuthContext(tokenAuth({ ...options, provider: GitHubProviderId, token }));
    }
  }) as AuthenticationStrategy;
}

/**
 * Creates a GitBridge client with the GitHub provider registered.
 */
export function createGitHubClient(config: GitHubClientConfig = {}): GitBridgeClient {
  const { authentication, token, ...providerConfig } = config;
  const resolvedProviderConfig: GitHubProviderConfig = {
    ...providerConfig,
    transport: providerConfig.transport ?? createGitHubHttpTransport()
  };

  return createGitBridgeClient({
    ...createGitHubProviderConfig(resolvedProviderConfig),
    authentication: authentication ?? (token === undefined ? undefined : githubTokenAuth(token))
  });
}

export class GitHubProvider implements Provider {
  readonly #config: GitHubProviderConfig;
  readonly #hosts: readonly string[];

  public readonly info: ProviderInfo;

  public constructor(config: GitHubProviderConfig = {}) {
    this.#hosts = deepFreeze(normalizeHosts(config.hosts ?? ["github.com"]));
    this.#config = Object.freeze({
      ...config,
      hosts: this.#hosts
    }) as GitHubProviderConfig;
    this.info = deepFreeze({
      capabilities: GitHubProviderCapabilities,
      id: GitHubProviderId,
      metadata: config.metadata,
      name: GitHubProviderName,
      priority: config.priority,
      version: GitHubProviderVersion
    }) as ProviderInfo;
  }

  public async supports(locator: RepositoryLocator): Promise<ProviderMatch> {
    const location = parseGitHubRepositoryUrl(locator.url, this.#hosts);

    if (location === undefined) {
      return deepFreeze({ confidence: "none", provider: GitHubProviderId }) as ProviderMatch;
    }

    return deepFreeze({
      confidence: "exact",
      metadata: { provider: GitHubProviderId, extra: { host: location.host } },
      provider: GitHubProviderId,
      repository: toRepositoryIdentity(location)
    }) as ProviderMatch;
  }

  public async createSession(request: CreateSessionRequest): Promise<ProviderSession> {
    return runGitHubProviderOperation("provider.session.create", async () => {
      const location = resolveRepositoryLocation(request.repository, this.#hosts);
      const dependencies = resolveDependencies(this.#config, request.context);
      const context = createGitHubSessionContext(request.context, dependencies);
      const requestContext: {
        authentication?: AuthenticationContext;
        metadata?: Metadata;
        transport: Transport;
      } = {
        transport: dependencies.transport
      };

      if (context.authenticationContext !== undefined) {
        requestContext.authentication = context.authenticationContext;
      }

      if (context.metadata !== undefined) {
        requestContext.metadata = context.metadata;
      }

      const requestClient = createGitHubRequestClient(requestContext);
      const fallback = toRepositoryInfo(location);
      const repository = await readRepositoryInfo(requestClient, location, fallback);

      return new GitHubProviderSession({
        context,
        requestClient,
        repository
      });
    });
  }
}

export class GitHubProviderSession implements ProviderSession {
  readonly #context: ProviderContext;
  #diagnosticSequence = 0;
  readonly #requestClient: GitHubRequestClient;
  #state: MutableSessionState = "active";

  public readonly capabilities: ProviderSessionCapabilities;
  public readonly provider = deepFreeze({
    capabilities: GitHubProviderCapabilities,
    id: GitHubProviderId,
    name: GitHubProviderName,
    version: GitHubProviderVersion
  }) as ProviderInfo;
  public readonly repository: RepositoryInfo;

  public constructor(
    input: Readonly<{
      context: ProviderContext;
      requestClient: GitHubRequestClient;
      repository: RepositoryInfo;
    }>
  ) {
    this.#context = Object.freeze(input.context) as ProviderContext;
    this.#requestClient = input.requestClient;
    this.repository = deepFreeze(input.repository) as RepositoryInfo;
    this.capabilities = createFoundationCapabilities(
      this.repository.identity,
      this.#requestClient,
      () => this.ensureActive()
    );
  }

  public get state(): MutableSessionState {
    return this.#state;
  }

  public get context(): ProviderContext {
    return this.#context;
  }

  public async getCapabilities(): Promise<readonly CapabilityDescriptor[]> {
    this.ensureActive();
    return foundationCapabilityDescriptors;
  }

  public async dispose(): Promise<void> {
    if (this.#state === "disposed") {
      return;
    }

    this.#state = "disposed";
    await this.publishDiagnostic("provider.session.dispose");
  }

  public ensureActive(): void {
    if (this.#state === "disposed") {
      throw new ProviderError("GitHub provider session has been disposed", {
        diagnostics: {
          operation: { operation: "provider.session.lifecycle" },
          provider: { provider: GitHubProviderId },
          repository: formatRepositoryDiagnostics(this.repository.identity)
        },
        retryability: "Never"
      });
    }
  }

  private async publishDiagnostic(name: string): Promise<void> {
    try {
      await this.#context.diagnostics?.publish(
        deepFreeze({
          context: {
            provider: GitHubProviderId,
            repository: `${this.repository.identity.owner}/${this.repository.identity.name}`
          },
          id: `github-${name}-${++this.#diagnosticSequence}`,
          kind: "provider",
          name,
          schemaVersion: "1.0",
          timestamp: new Date().toISOString()
        })
      );
    } catch {
      // Diagnostics are observational and must not influence provider lifecycle.
    }
  }
}

function createGitHubRequestClient(context: GitHubRequestContext): GitHubRequestClient {
  return deepFreeze({
    async request<TBody = unknown>(request: GitHubRequest): Promise<GitHubResponse<TBody>> {
      const transportRequest = toTransportRequest(request, context);

      try {
        const transportContext: { metadata?: Metadata } = {};

        if (context.metadata !== undefined) {
          transportContext.metadata = context.metadata;
        }

        const response = await context.transport.execute<TBody>(transportRequest, transportContext);
        return fromTransportResponse(response);
      } catch (error: unknown) {
        throw mapGitHubError(error, "github.transport.request");
      }
    }
  }) as GitHubRequestClient;
}

async function readRepositoryInfo(
  requestClient: GitHubRequestClient,
  location: GitHubRepositoryLocation,
  fallback: RepositoryInfo
): Promise<RepositoryInfo> {
  const response = await requestGitHubResponse<GitHubRepositoryModel>(
    requestClient,
    "github.repository.get",
    `/repos/${encodePathPart(location.owner)}/${encodePathPart(location.name)}`
  );

  if (response.data === undefined || response.status === 204) {
    return fallback;
  }

  return mapGitHubRepository(response.data, fallback.identity);
}

async function readContent(
  requestClient: GitHubRequestClient,
  repository: RepositoryIdentity,
  path: FilePath,
  operation: string
): Promise<GitHubContentModel> {
  const response = await requestGitHub<GitHubContentModel | readonly GitHubContentModel[]>(
    requestClient,
    operation,
    `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/contents/${encodeRepositoryPath(path)}`
  );

  if (Array.isArray(response)) {
    throw new ValidationError("GitHub content response is a directory, not a file", {
      diagnostics: {
        operation: { operation },
        provider: { provider: GitHubProviderId },
        repository: formatRepositoryDiagnostics(repository)
      }
    });
  }

  return response as GitHubContentModel;
}

async function requestGitHub<TBody>(
  requestClient: GitHubRequestClient,
  operation: string,
  url: string
): Promise<TBody> {
  const response = await requestGitHubResponse<TBody>(requestClient, operation, url);

  if (response.data === undefined) {
    throw new ProviderError("GitHub response did not include a response body", {
      diagnostics: {
        operation: { operation },
        provider: { provider: GitHubProviderId, status: response.status }
      },
      retryability: "Maybe"
    });
  }

  return response.data;
}

async function requestGitHubResponse<TBody>(
  requestClient: GitHubRequestClient,
  operation: string,
  url: string
): Promise<GitHubResponse<TBody>> {
  try {
    const response = await requestClient.request<TBody>({ method: "GET", url });

    if (response.status === 404) {
      throw new NotFoundError("GitHub resource was not found", {
        diagnostics: {
          operation: { operation },
          provider: { provider: GitHubProviderId, status: response.status }
        },
        retryability: "Never"
      });
    }

    if (response.status < 200 || response.status >= 300) {
      throw createGitHubStatusError(response.status, operation, response.headers);
    }

    return response;
  } catch (error: unknown) {
    throw mapGitHubError(error, operation);
  }
}

export function mapGitHubError(error: unknown, operation = "github.provider"): GitBridgeError {
  if (error instanceof GitBridgeError) {
    return error;
  }

  const status = getErrorStatus(error);
  const providerDiagnostics: {
    provider?: string;
    providerCode?: string;
    requestId?: string;
    status?: number;
  } = {
    provider: GitHubProviderId
  };

  const providerCode = getErrorCode(error);

  if (providerCode !== undefined) {
    providerDiagnostics.providerCode = providerCode;
  }

  const requestId = getErrorRequestId(error);

  if (requestId !== undefined) {
    providerDiagnostics.requestId = requestId;
  }

  if (status !== undefined) {
    providerDiagnostics.status = status;
  }

  const diagnostics: ErrorDiagnostics = {
    operation: { operation },
    provider: providerDiagnostics
  };

  if (status === 401) {
    return new AuthenticationError("GitHub authentication failed", {
      cause: error,
      diagnostics,
      retryability: "Never"
    });
  }

  if (status === 403 && isRateLimitError(error)) {
    return new RateLimitError("GitHub rate limit exceeded", {
      cause: error,
      diagnostics,
      retryability: "Always"
    });
  }

  if (status === 403) {
    return new AuthorizationError("GitHub authorization failed", {
      cause: error,
      diagnostics,
      retryability: "Never"
    });
  }

  if (status === 404) {
    return new NotFoundError("GitHub resource was not found", {
      cause: error,
      diagnostics,
      retryability: "Never"
    });
  }

  if (status === 409) {
    return new ConflictError("GitHub reported a resource conflict", {
      cause: error,
      diagnostics,
      retryability: "Maybe"
    });
  }

  if (status !== undefined && status >= 500) {
    return new ProviderError("GitHub provider request failed", {
      cause: error,
      diagnostics,
      retryability: "Maybe"
    });
  }

  if (status !== undefined) {
    return new ProviderError("GitHub provider rejected the request", {
      cause: error,
      diagnostics,
      retryability: retryabilityForStatus(status)
    });
  }

  return new ProviderError("GitHub provider operation failed", {
    cause: error,
    diagnostics,
    retryability: "Maybe"
  });
}

function createGitHubSessionContext(
  context: ProviderContext,
  dependencies: GitHubProviderDependencies
): ProviderContext {
  return Object.freeze({
    ...context,
    cache: dependencies.cache,
    diagnostics: dependencies.diagnostics,
    provider: {
      ...context.provider,
      capabilities: GitHubProviderCapabilities
    },
    transport: dependencies.transport
  }) as ProviderContext;
}

function resolveDependencies(
  config: GitHubProviderConfig,
  context: ProviderContext
): GitHubProviderDependencies {
  const dependencies: {
    cache?: CacheProvider;
    diagnostics?: DiagnosticsService;
    transport: Transport;
  } = {
    transport: config.transport ?? context.transport ?? createGitHubHttpTransport()
  };

  const cache = config.cache ?? context.cache;
  const diagnostics = config.diagnostics ?? context.diagnostics;

  if (cache !== undefined) {
    dependencies.cache = cache;
  }

  if (diagnostics !== undefined) {
    dependencies.diagnostics = diagnostics;
  }

  return dependencies;
}

function createFoundationCapabilities(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): ProviderSessionCapabilities {
  const runtime = createGitHubRuntimeCapabilities(repository, requestClient, ensureActive);

  return deepFreeze({
    branches: runtime.branches,
    files: runtime.files,
    history: runtime.history,
    issues: runtime.issues,
    pullRequests: runtime.pullRequests,
    releases: runtime.releases,
    search: runtime.search,
    tags: runtime.tags,
    tree: runtime.tree
  }) as ProviderSessionCapabilities;
}

function createGitHubRuntimeCapabilities(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): Readonly<{
  branches: BranchesCapability;
  files: FilesCapability;
  history: HistoryCapability;
  issues: IssuesCapability;
  pullRequests: PullRequestsCapability;
  releases: ReleasesCapability;
  search: SearchCapability;
  tags: TagsCapability;
  tree: TreeCapability;
}> {
  return deepFreeze({
    branches: createGitHubBranchesCapability(repository, requestClient, ensureActive),
    files: createGitHubFilesCapability(repository, requestClient, ensureActive),
    history: createGitHubHistoryCapability(repository, requestClient, ensureActive),
    issues: createGitHubIssuesCapability(repository, requestClient, ensureActive),
    pullRequests: createGitHubPullRequestsCapability(repository, requestClient, ensureActive),
    releases: createGitHubReleasesCapability(repository, requestClient, ensureActive),
    search: createGitHubSearchCapability(repository, requestClient, ensureActive),
    tags: createGitHubTagsCapability(repository, requestClient, ensureActive),
    tree: createGitHubTreeCapability(repository, requestClient, ensureActive)
  });
}

function createGitHubBranchesCapability(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): BranchesCapability {
  return deepFreeze({
    async get(name: string): Promise<Branch> {
      ensureActive();
      validateNonEmpty(name, "Branch name must be a non-empty string");
      const response = await requestGitHub<GitHubBranchModel>(
        requestClient,
        "github.branches.get",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/branches/${encodePathPart(name)}`
      );
      return mapGitHubBranch(response, repository);
    },
    async list(_options?: BranchListOptions): Promise<PagedResult<Branch>> {
      ensureActive();
      const response = await requestGitHub<readonly GitHubBranchModel[]>(
        requestClient,
        "github.branches.list",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/branches`
      );

      return createPage(response.map((branch) => mapGitHubBranch(branch, repository)));
    }
  }) as BranchesCapability;
}

function createGitHubTagsCapability(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): TagsCapability {
  return deepFreeze({
    async get(name: TagName): Promise<Tag> {
      ensureActive();
      validateNonEmpty(name, "Tag name must be a non-empty string");
      const response = await requestGitHub<GitHubRefModel>(
        requestClient,
        "github.tags.get",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/git/ref/tags/${encodePathPart(name)}`
      );
      return mapGitHubTag(response, repository);
    },
    async list(_options?: TagListOptions): Promise<PagedResult<Tag>> {
      ensureActive();
      const response = await requestGitHub<readonly GitHubRefModel[]>(
        requestClient,
        "github.tags.list",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/git/refs/tags`
      );

      return createPage(response.map((tag) => mapGitHubTag(tag, repository)));
    }
  }) as TagsCapability;
}

function createGitHubHistoryCapability(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): HistoryCapability {
  return deepFreeze({
    async file(path: FilePath, _options?: FileHistoryOptions): Promise<PagedResult<Commit>> {
      ensureActive();
      validatePath(path);
      const response = await requestGitHub<readonly GitHubCommitModel[]>(
        requestClient,
        "github.history.file",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/commits?path=${encodeURIComponent(path)}`
      );

      return createPage(response.map(mapGitHubCommit));
    },
    async get(sha: string): Promise<Commit> {
      ensureActive();
      validateNonEmpty(sha, "Commit sha must be a non-empty string");
      const response = await requestGitHub<GitHubCommitModel>(
        requestClient,
        "github.history.get",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/commits/${encodePathPart(sha)}`
      );
      return mapGitHubCommit(response);
    },
    async list(_options?: CommitListOptions): Promise<PagedResult<Commit>> {
      ensureActive();
      const response = await requestGitHub<readonly GitHubCommitModel[]>(
        requestClient,
        "github.history.list",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/commits`
      );

      return createPage(response.map(mapGitHubCommit));
    }
  }) as HistoryCapability;
}

function createGitHubTreeCapability(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): TreeCapability {
  return deepFreeze({
    async get(path: FilePath): Promise<ReturnType<typeof mapGitHubContentToTreeNode>> {
      ensureActive();
      validatePath(path);
      const response = await requestGitHub<GitHubContentModel>(
        requestClient,
        "github.tree.get",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/contents/${encodeRepositoryPath(path)}`
      );
      return mapGitHubContentToTreeNode(response);
    },
    async list(path?: FilePath): Promise<readonly ReturnType<typeof mapGitHubContentToTreeNode>[]> {
      ensureActive();
      validateOptionalPath(path);
      const suffix = path === undefined ? "" : `/${encodeRepositoryPath(path)}`;
      const response = await requestGitHub<GitHubContentModel | readonly GitHubContentModel[]>(
        requestClient,
        "github.tree.list",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/contents${suffix}`
      );

      const items = Array.isArray(response) ? response : [response];
      return deepFreeze(items.map(mapGitHubContentToTreeNode));
    },
    async tree(path?: FilePath): Promise<Tree> {
      ensureActive();
      validateOptionalPath(path);
      const ref = path ?? "HEAD";
      const response = await requestGitHub<GitHubTreeModel>(
        requestClient,
        "github.tree.tree",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/git/trees/${encodePathPart(ref)}`
      );
      return mapGitHubTree(response, path ?? "");
    },
    walk(): AsyncIterable<never> {
      ensureActive();
      return rejectUnsupportedIterable("tree", repository);
    }
  }) as TreeCapability;
}

function createGitHubFilesCapability(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): FilesCapability {
  return deepFreeze({
    async download(path: FilePath): Promise<Blob> {
      ensureActive();
      validatePath(path);
      const response = await readContent(requestClient, repository, path, "github.files.download");
      return mapGitHubContentToBlob(response);
    },
    async exists(path: FilePath): Promise<boolean> {
      ensureActive();
      validatePath(path);

      try {
        await readContent(requestClient, repository, path, "github.files.exists");
        return true;
      } catch (error: unknown) {
        if (error instanceof NotFoundError) {
          return false;
        }

        throw error;
      }
    },
    async metadata(path: FilePath): Promise<FileInfo> {
      ensureActive();
      validatePath(path);
      return mapGitHubContentToFileInfo(
        await readContent(requestClient, repository, path, "github.files.metadata")
      );
    },
    async getMetadata(path: FilePath): Promise<FileInfo> {
      return this.metadata(path);
    },
    async readBinary(path: FilePath): Promise<Uint8Array> {
      ensureActive();
      validatePath(path);
      const blob = mapGitHubContentToBlob(
        await readContent(requestClient, repository, path, "github.files.readBinary")
      );
      return decodeBlobContent(blob);
    },
    async readJson<TValue extends JsonValue = JsonValue>(path: FilePath): Promise<TValue> {
      ensureActive();
      const text = await this.readText(path);
      return JSON.parse(text) as TValue;
    },
    async readText(path: FilePath): Promise<string> {
      ensureActive();
      validatePath(path);
      return new TextDecoder().decode(
        decodeBlobContent(
          mapGitHubContentToBlob(
            await readContent(requestClient, repository, path, "github.files.readText")
          )
        )
      );
    },
    async stream(path: FilePath): Promise<AsyncIterable<Uint8Array>> {
      ensureActive();
      validatePath(path);
      const content = await this.readBinary(path);

      return (async function* streamContent() {
        yield content;
      })();
    }
  }) as FilesCapability;
}

function createGitHubIssuesCapability(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): IssuesCapability {
  return deepFreeze({
    async get(number: number): Promise<Issue> {
      ensureActive();
      validatePositiveInteger(number, "Issue number must be a positive integer");
      const response = await requestGitHub<GitHubIssueModel>(
        requestClient,
        "github.issues.get",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/issues/${number}`
      );
      return mapGitHubIssue(response);
    },
    async list(options?: IssueListOptions): Promise<PagedResult<Issue>> {
      ensureActive();
      return requestGitHubPage<GitHubIssueModel, Issue>(
        requestClient,
        "github.issues.list",
        withPagination(
          `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/issues`,
          options
        ),
        mapGitHubIssue
      );
    }
  }) as IssuesCapability;
}

function createGitHubPullRequestsCapability(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): PullRequestsCapability {
  return deepFreeze({
    async get(number: number): Promise<PullRequest> {
      ensureActive();
      validatePositiveInteger(number, "Pull request number must be a positive integer");
      const response = await requestGitHub<GitHubPullRequestModel>(
        requestClient,
        "github.pullRequests.get",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/pulls/${number}`
      );
      return mapGitHubPullRequest(response, repository);
    },
    async list(options?: PullRequestListOptions): Promise<PagedResult<PullRequest>> {
      ensureActive();
      return requestGitHubPage<GitHubPullRequestModel, PullRequest>(
        requestClient,
        "github.pullRequests.list",
        withPagination(
          `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/pulls`,
          options
        ),
        (pullRequest) => mapGitHubPullRequest(pullRequest, repository)
      );
    }
  }) as PullRequestsCapability;
}

function createGitHubReleasesCapability(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): ReleasesCapability {
  return deepFreeze({
    async get(tagName: TagName): Promise<Release> {
      ensureActive();
      validateNonEmpty(tagName, "Release tag name must be a non-empty string");
      const response = await requestGitHub<GitHubReleaseModel>(
        requestClient,
        "github.releases.get",
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/releases/tags/${encodePathPart(tagName)}`
      );
      return mapGitHubRelease(response);
    },
    async list(options?: ReleaseListOptions): Promise<PagedResult<Release>> {
      ensureActive();
      return requestGitHubPage<GitHubReleaseModel, Release>(
        requestClient,
        "github.releases.list",
        withPagination(
          `/repos/${encodePathPart(repository.owner)}/${encodePathPart(repository.name)}/releases`,
          options
        ),
        mapGitHubRelease
      );
    }
  }) as ReleasesCapability;
}

function createGitHubSearchCapability(
  repository: RepositoryIdentity,
  requestClient: GitHubRequestClient,
  ensureActive: () => void
): SearchCapability {
  return deepFreeze({
    async query<TItem = FileInfo>(query: SearchQuery): Promise<PagedResult<SearchResult<TItem>>> {
      ensureActive();
      validateNonEmpty(query.text, "Search query text must be a non-empty string");
      const pathQualifier = query.path === undefined ? "" : ` path:${query.path}`;
      const response = await requestGitHub<GitHubSearchResponseModel>(
        requestClient,
        "github.search.query",
        withPagination(
          `/search/code?q=${encodeURIComponent(`${query.text} repo:${repository.owner}/${repository.name}${pathQualifier}`)}`,
          query
        )
      );
      return createSearchPage<TItem>(response);
    },
    async text(
      query: string,
      options?: Parameters<SearchCapability["text"]>[1]
    ): Promise<PagedResult<SearchResult<FileInfo>>> {
      ensureActive();
      validateNonEmpty(query, "Search query text must be a non-empty string");
      return this.query<FileInfo>({ text: query, ...(options ?? {}) });
    }
  }) as SearchCapability;
}

async function requestGitHubPage<TModel, TItem>(
  requestClient: GitHubRequestClient,
  operation: string,
  url: string,
  map: (model: TModel) => TItem
): Promise<PagedResult<TItem>> {
  const response = await requestGitHubResponse<readonly TModel[]>(requestClient, operation, url);

  if (response.data === undefined) {
    throw new ProviderError("GitHub response did not include a response body", {
      diagnostics: {
        operation: { operation },
        provider: { provider: GitHubProviderId, status: response.status }
      },
      retryability: "Maybe"
    });
  }

  return createPage(response.data.map(map), response.headers);
}

function createSearchPage<TItem>(
  response: GitHubSearchResponseModel
): PagedResult<SearchResult<TItem>> {
  return deepFreeze({
    items: (response.items ?? []).map((item) => mapGitHubSearchItem(item) as SearchResult<TItem>),
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      totalCount: response.total_count
    }
  }) as PagedResult<SearchResult<TItem>>;
}

async function rejectUnsupported<TValue>(
  capability: keyof CapabilityMap,
  repository: RepositoryIdentity
): Promise<TValue> {
  throw new CapabilityNotSupportedError("GitHub provider capability operation is not supported", {
    diagnostics: {
      operation: { capability, operation: `github.${capability}` },
      provider: { provider: GitHubProviderId },
      repository: formatRepositoryDiagnostics(repository)
    },
    retryability: "Never"
  });
}

async function* rejectUnsupportedIterable<TValue>(
  capability: keyof CapabilityMap,
  repository: RepositoryIdentity
): AsyncIterable<TValue> {
  await rejectUnsupported<TValue>(capability, repository);
}

function parseGitHubRepositoryUrl(
  value: string,
  hosts: readonly string[]
): GitHubRepositoryLocation | undefined {
  try {
    const url = new URL(value);
    const host = normalizeHost(url.hostname);

    if (!hosts.includes(host)) {
      return undefined;
    }

    const parts = url.pathname
      .replace(/\.git$/u, "")
      .split("/")
      .filter((part) => part.length > 0);

    const offset = host === "api.github.com" && parts[0] === "repos" ? 1 : 0;
    const owner = parts[offset];
    const name = parts[offset + 1];

    if (owner === undefined || name === undefined) {
      return undefined;
    }

    return { host, name, owner, url: `https://${host}/${owner}/${name}` };
  } catch {
    return undefined;
  }
}

function resolveRepositoryLocation(
  repository: CreateSessionRequest["repository"],
  hosts: readonly string[]
): GitHubRepositoryLocation {
  if ("url" in repository) {
    const location = parseGitHubRepositoryUrl(repository.url, hosts);

    if (location === undefined) {
      throw new ValidationError("Repository locator is not a supported GitHub URL", {
        diagnostics: {
          operation: { operation: "github.repository.resolve" },
          provider: { provider: GitHubProviderId },
          extra: { url: repository.url }
        }
      });
    }

    return location;
  }

  validateRepositoryIdentity(repository);
  return {
    host: hosts[0] ?? "github.com",
    name: repository.name,
    owner: repository.owner,
    url: `https://${hosts[0] ?? "github.com"}/${repository.owner}/${repository.name}`
  };
}

function toRepositoryIdentity(location: GitHubRepositoryLocation): RepositoryIdentity {
  return deepFreeze({
    name: location.name,
    owner: location.owner,
    provider: GitHubProviderId
  }) as RepositoryIdentity;
}

function toRepositoryInfo(location: GitHubRepositoryLocation): RepositoryInfo {
  const identity = toRepositoryIdentity(location);

  return deepFreeze({
    fullName: `${identity.owner}/${identity.name}`,
    identity,
    metadata: { provider: GitHubProviderId, extra: { host: location.host } },
    name: identity.name,
    owner: { username: identity.owner },
    url: location.url,
    visibility: "unknown"
  }) as RepositoryInfo;
}

function toTransportRequest(
  request: GitHubRequest,
  context: GitHubRequestContext
): TransportRequest {
  const headers = {
    accept: "application/vnd.github+json",
    ...authorizationHeader(context.authentication),
    ...request.headers
  };

  return deepFreeze({
    body: request.body,
    headers,
    method: toTransportMethod(request.method),
    metadata: {
      provider: GitHubProviderId,
      ...context.metadata
    },
    signal: request.signal,
    target: request.url,
    timeoutMs: request.timeoutMs
  }) as TransportRequest;
}

function fromTransportResponse<TBody>(
  response: TransportResponse<TBody> | GitHubDataResponse<TBody>
): GitHubResponse<TBody> {
  const data = getResponseData<TBody>(response);

  return deepFreeze({
    data,
    headers: response.headers,
    status: response.status
  }) as GitHubResponse<TBody>;
}

function getResponseData<TBody>(
  response: TransportResponse<TBody> | GitHubDataResponse<TBody>
): TBody | undefined {
  const record = response as Readonly<{ body?: TBody; data?: TBody }>;
  return record.body ?? record.data;
}

function toTransportMethod(method: GitHubRequest["method"]): TransportRequest["method"] {
  if (method === undefined || method === "GET") {
    return "read";
  }

  if (method === "DELETE") {
    return "delete";
  }

  return "write";
}

function authorizationHeader(
  authentication: AuthenticationContext | undefined
): Readonly<Record<string, string>> {
  const credentials = authentication?.credentials;

  if (credentials === undefined || credentials.kind === "anonymous" || !("token" in credentials)) {
    return {};
  }

  return { authorization: `Bearer ${credentials.token}` };
}

function createGitHubHttpTransport(): Transport {
  return deepFreeze({
    async execute<TBody = unknown>(request: TransportRequest): Promise<TransportResponse<TBody>> {
      const response = await executeGitHubHttpRequest(request);
      return createTransportResponse<TBody>(response as TransportResponse<TBody>);
    }
  }) as Transport;
}

async function executeGitHubHttpRequest<TBody = unknown>(
  request: TransportRequest
): Promise<TransportResponse<TBody>> {
  const requestUrl = toGitHubApiUrl(request.target);
  const init: RequestInit = {
    method: toHttpMethod(request.method)
  };
  const requestBody = toHttpRequestBody(request.body);

  if (requestBody !== undefined) {
    init.body = requestBody;
  }

  if (request.headers !== undefined) {
    init.headers = request.headers;
  }

  if (request.signal !== undefined) {
    init.signal = request.signal as AbortSignal;
  }

  const response = await getFetchImplementation()(requestUrl, init);
  const responseBody = await readHttpResponseBody<TBody>(response);
  const transportResponse: {
    body?: unknown;
    headers: Readonly<Record<string, string>>;
    status: number;
  } = {
    headers: Object.fromEntries(response.headers.entries()),
    status: response.status
  };

  if (responseBody !== undefined) {
    transportResponse.body = responseBody;
  }

  return transportResponse as TransportResponse<TBody>;
}

function getFetchImplementation(): typeof globalThis.fetch {
  const fetchImplementation = globalThis["fetch"];

  if (typeof fetchImplementation !== "function") {
    throw new TransportError("GitHub provider requires a fetch-compatible runtime", {
      diagnostics: {
        operation: { operation: "github.transport.configure" },
        provider: { provider: GitHubProviderId }
      },
      retryability: "Never"
    });
  }

  return fetchImplementation.bind(globalThis);
}

function toGitHubApiUrl(target: string): string {
  if (/^https?:\/\//u.test(target)) {
    return target;
  }

  return `https://api.github.com${target.startsWith("/") ? target : `/${target}`}`;
}

function toHttpMethod(method: TransportRequest["method"]): string {
  switch (method) {
    case "delete":
      return "DELETE";
    case "write":
      return "POST";
    case "read":
    case "stream":
      return "GET";
  }
}

function toHttpRequestBody(body: TransportRequest["body"]): RequestInit["body"] | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (typeof body === "string" || body instanceof Uint8Array) {
    return body;
  }

  return JSON.stringify(body);
}

async function readHttpResponseBody<TBody>(response: Response): Promise<TBody | undefined> {
  if (response.status === 204 || response.status === 205) {
    return undefined;
  }

  const text = await response.text();

  if (text.length === 0) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return JSON.parse(text) as TBody;
  }

  return text as TBody;
}

function createGitHubStatusError(
  status: number,
  operation: string,
  headers?: Readonly<Record<string, string>>
): GitBridgeError {
  if (status === 401) {
    return new AuthenticationError("GitHub authentication failed", {
      diagnostics: {
        operation: { operation },
        provider: { provider: GitHubProviderId, status }
      },
      retryability: "Never"
    });
  }

  if (status === 403 && isRateLimitError({ headers, status })) {
    return new RateLimitError("GitHub rate limit exceeded", {
      diagnostics: {
        operation: { operation },
        provider: { provider: GitHubProviderId, status }
      },
      retryability: "Always"
    });
  }

  if (status === 403) {
    return new AuthorizationError("GitHub authorization failed", {
      diagnostics: {
        operation: { operation },
        provider: { provider: GitHubProviderId, status }
      },
      retryability: "Never"
    });
  }

  if (status === 404) {
    return new NotFoundError("GitHub resource was not found", {
      diagnostics: {
        operation: { operation },
        provider: { provider: GitHubProviderId, status }
      },
      retryability: "Never"
    });
  }

  if (status === 409) {
    return new ConflictError("GitHub reported a resource conflict", {
      diagnostics: {
        operation: { operation },
        provider: { provider: GitHubProviderId, status }
      },
      retryability: "Maybe"
    });
  }

  return new ProviderError("GitHub provider rejected the request", {
    diagnostics: {
      operation: { operation },
      provider: { provider: GitHubProviderId, status }
    },
    retryability: retryabilityForStatus(status)
  });
}

function createPage<TItem>(
  items: readonly TItem[],
  headers?: Readonly<Record<string, string>>
): PagedResult<TItem> {
  const link = headers?.link ?? headers?.Link;

  return deepFreeze({
    items,
    pageInfo: parsePaginationInfo(link)
  }) as PagedResult<TItem>;
}

function parsePaginationInfo(link: string | undefined): PagedResult<unknown>["pageInfo"] {
  if (link === undefined) {
    return {
      hasNextPage: false,
      hasPreviousPage: false
    };
  }

  const info: {
    endCursor?: string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
  } = {
    hasNextPage: link.includes('rel="next"'),
    hasPreviousPage: link.includes('rel="prev"')
  };

  const next = extractPageCursor(link, "next");
  const previous = extractPageCursor(link, "prev");

  if (next !== undefined) {
    info.endCursor = next;
  }

  if (previous !== undefined) {
    info.startCursor = previous;
  }

  return info;
}

function extractPageCursor(link: string, relation: "next" | "prev"): string | undefined {
  const match = new RegExp(`<[^>]*[?&]page=([^>&]+)[^>]*>;\\s*rel="${relation}"`, "u").exec(link);
  return match?.[1];
}

function withPagination(
  url: string,
  options: Readonly<{ cursor?: string; limit?: number }> | undefined
): string {
  const parameters: string[] = [];

  if (options?.cursor !== undefined) {
    parameters.push(`page=${encodeURIComponent(options.cursor)}`);
  }

  if (options?.limit !== undefined) {
    parameters.push(`per_page=${encodeURIComponent(String(options.limit))}`);
  }

  if (parameters.length === 0) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}${parameters.join("&")}`;
}

function decodeBlobContent(blob: Blob): Uint8Array {
  if (blob.content instanceof Uint8Array) {
    return blob.content;
  }

  if (blob.content === undefined) {
    return new Uint8Array();
  }

  if (blob.encoding === "base64") {
    return Buffer.from(blob.content.replace(/\s+/gu, ""), "base64");
  }

  return new TextEncoder().encode(blob.content);
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

function encodeRepositoryPath(path: string): string {
  return path.split("/").map(encodePathPart).join("/");
}

async function runGitHubProviderOperation<TValue>(
  operation: string,
  execute: () => Promise<TValue> | TValue
): Promise<TValue> {
  try {
    return await execute();
  } catch (error: unknown) {
    throw mapGitHubError(error, operation);
  }
}

function getErrorStatus(error: unknown): number | undefined {
  return getNumericProperty(error, "status") ?? getNumericProperty(error, "statusCode");
}

function getErrorCode(error: unknown): string | undefined {
  return getStringProperty(error, "code");
}

function getErrorRequestId(error: unknown): string | undefined {
  const headers = getHeaders(error);
  return headers?.["x-github-request-id"] ?? headers?.["x-request-id"];
}

function isRateLimitError(error: unknown): boolean {
  const headers = getHeaders(error);
  return headers?.["x-ratelimit-remaining"] === "0" || getErrorCode(error) === "rate_limit";
}

function getHeaders(error: unknown): Readonly<Record<string, string>> | undefined {
  if (error === null || typeof error !== "object" || !("headers" in error)) {
    return undefined;
  }

  const headers = (error as { readonly headers?: unknown }).headers;

  if (headers === null || typeof headers !== "object") {
    return undefined;
  }

  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      normalized[key.toLowerCase()] = value;
    }
  }

  return normalized;
}

function getNumericProperty(error: unknown, key: string): number | undefined {
  if (error === null || typeof error !== "object" || !(key in error)) {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function getStringProperty(error: unknown, key: string): string | undefined {
  if (error === null || typeof error !== "object" || !(key in error)) {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function retryabilityForStatus(status: number): ErrorRetryability {
  return status === 408 || status === 409 || status === 429 ? "Maybe" : "Never";
}

function normalizeHosts(hosts: readonly string[]): readonly string[] {
  const normalized = hosts.map(normalizeHost);

  if (normalized.length === 0) {
    throw new ValidationError("GitHub provider requires at least one host", {
      diagnostics: {
        operation: { operation: "github.provider.configure" },
        provider: { provider: GitHubProviderId }
      }
    });
  }

  return [...new Set(normalized)];
}

function normalizeHost(host: string): string {
  validateNonEmpty(host, "GitHub host must be a non-empty string");
  return host.toLowerCase().replace(/^www\./u, "");
}

function validateRepositoryIdentity(identity: RepositoryIdentity): void {
  validateNonEmpty(identity.provider, "Repository provider must be a non-empty string");
  validateNonEmpty(identity.owner, "Repository owner must be a non-empty string");
  validateNonEmpty(identity.name, "Repository name must be a non-empty string");

  if (identity.provider !== GitHubProviderId) {
    throw new ValidationError("Repository identity does not belong to the GitHub provider", {
      diagnostics: {
        operation: { operation: "github.repository.validate" },
        provider: { provider: GitHubProviderId },
        repository: formatRepositoryDiagnostics(identity)
      }
    });
  }
}

function validatePath(path: FilePath): void {
  validateNonEmpty(path, "Repository path must be a non-empty string");
}

function validateOptionalPath(path: FilePath | undefined): void {
  if (path !== undefined) {
    validatePath(path);
  }
}

function validatePositiveInteger(value: number, message: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(message, {
      diagnostics: {
        operation: { operation: "github.provider.validate" },
        provider: { provider: GitHubProviderId }
      }
    });
  }
}

function validateNonEmpty(value: string, message: string): void {
  if (value.trim() === "") {
    throw new ValidationError(message, {
      diagnostics: {
        operation: { operation: "github.provider.validate" },
        provider: { provider: GitHubProviderId }
      }
    });
  }
}

function formatRepositoryDiagnostics(
  identity: RepositoryIdentity
): NonNullable<ErrorDiagnostics["repository"]> {
  return {
    provider: identity.provider,
    repository: `${identity.owner}/${identity.name}`
  };
}
