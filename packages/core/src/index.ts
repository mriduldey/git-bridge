import type { AuthenticationStrategy } from "@gitbridge/auth";
import { createCacheRegistry, type CacheRegistry } from "@gitbridge/cache";
import type {
  Blob,
  BranchesCapability,
  BranchListOptions,
  CapabilityDescriptor,
  CapabilityMap,
  CommitListOptions,
  DiagnosticsService,
  DownloadOptions,
  FileHistoryOptions,
  FileInfo,
  FilePath,
  FilesCapability,
  HistoryCapability,
  IssueListOptions,
  IssuesCapability,
  JsonValue,
  Metadata,
  OperationOptions,
  Provider,
  ProviderId,
  PullRequestListOptions,
  PullRequestsCapability,
  ReadBinaryOptions,
  ReadFileOptions,
  Reference,
  ReferenceName,
  ReleaseListOptions,
  ReleasesCapability,
  Repository as RepositoryContract,
  RepositoryIdentity,
  RepositoryInfo,
  RepositoryRef as RepositoryRefContract,
  SearchCapability,
  SearchQuery,
  SearchResult,
  TagListOptions,
  TagName,
  TagsCapability,
  TextSearchOptions,
  Transport,
  Tree,
  TreeCapability,
  TreeListOptions,
  TreeNode,
  TreeWalkOptions
} from "@gitbridge/contracts";
import type { Branch, Commit, Issue, PullRequest, Release, Tag } from "@gitbridge/contracts/domain";
import type { PagedResult } from "@gitbridge/contracts/pagination";
import {
  CapabilityNotSupportedError,
  ConfigurationError,
  ConflictError,
  NotFoundError,
  RepositoryError,
  ValidationError,
  type ErrorDiagnostics
} from "@gitbridge/errors";
import {
  createNoopDiagnosticsService,
  createNoopMetricCollector,
  createNoopTracer,
  type MetricCollector,
  type Tracer
} from "@gitbridge/observability";
import { deepFreeze } from "@gitbridge/shared";
import { createNoopTransport } from "@gitbridge/transport";

export type {
  AuthenticationStrategy,
  CacheRegistry,
  CapabilityDescriptor,
  CapabilityMap,
  DiagnosticsService,
  FilePath,
  OperationOptions,
  Metadata,
  MetricCollector,
  Provider,
  ProviderId,
  Reference,
  ReferenceName,
  RepositoryContract,
  RepositoryIdentity,
  RepositoryInfo,
  RepositoryRefContract,
  Tracer,
  Transport
};

export type GitBridgeLifecycleState = "active" | "disposed";
export type RepositoryLifecycleState = "active" | "disposed";

export type GitBridgeClientConfig = Readonly<{
  authentication?: AuthenticationStrategy | undefined;
  cache?: CacheRegistry;
  capabilities?: readonly CapabilityDescriptor[];
  diagnostics?: DiagnosticsService;
  metadata?: Metadata | undefined;
  metrics?: MetricCollector;
  providers?: readonly Provider[];
  tracer?: Tracer;
  transport?: Transport;
}>;

export type GitBridgeResolvedConfig = Readonly<{
  authentication?: AuthenticationStrategy | undefined;
  cache: CacheRegistry;
  capabilities: readonly CapabilityDescriptor[];
  diagnostics: DiagnosticsService;
  metadata?: Metadata | undefined;
  metrics: MetricCollector;
  providers: readonly Provider[];
  tracer: Tracer;
  transport: Transport;
}>;

export type ConfigurationLayer<TConfig extends object = GitBridgeClientConfig> = Readonly<{
  defaults?: Partial<TConfig>;
  client?: Partial<TConfig>;
  repository?: Partial<TConfig>;
  operation?: Partial<TConfig>;
}>;

export interface ProviderRegistryView {
  all(): readonly Provider[];
  get(id: ProviderId): Provider | undefined;
  has(id: ProviderId): boolean;
  ids(): readonly ProviderId[];
  require(id: ProviderId): Provider;
}

export interface CapabilityRegistryView {
  all(): readonly CapabilityDescriptor[];
  get(name: string): CapabilityDescriptor | undefined;
  has(name: string): boolean;
  names(): readonly string[];
  require(name: string): CapabilityDescriptor;
}

export type GitBridgeRuntimeContext = Readonly<{
  authentication?: AuthenticationStrategy | undefined;
  cache: CacheRegistry;
  capabilities: CapabilityRegistryView;
  diagnostics: DiagnosticsService;
  metadata?: Metadata | undefined;
  metrics: MetricCollector;
  providers: ProviderRegistryView;
  tracer: Tracer;
  transport: Transport;
}>;

export type RepositoryCapabilityServices = Readonly<{
  files: FilesCapability;
  tree: TreeCapability;
  history: HistoryCapability;
  search: SearchCapability;
  branches: BranchesCapability;
  tags: TagsCapability;
  releases: ReleasesCapability;
  issues: IssuesCapability;
  pullRequests: PullRequestsCapability;
}>;

export type RepositoryOptions = Readonly<{
  capabilities?: CapabilityMap;
  defaultReference?: ReferenceName;
  extensions?: Readonly<Record<string, unknown>>;
  info: RepositoryInfo;
  services?: Partial<RepositoryCapabilityServices>;
}>;

export type RepositoryRefOptions = Readonly<{
  capabilities: CapabilityMap;
  reference: ReferenceName | Reference;
  repository: RepositoryIdentity;
  services?: Partial<RepositoryCapabilityServices>;
}>;

export function createGitBridgeClient(config: GitBridgeClientConfig = {}): GitBridgeClient {
  return new GitBridgeClient(config);
}

export function resolveGitBridgeConfig(
  config: GitBridgeClientConfig = {}
): GitBridgeResolvedConfig {
  return freezeResolvedConfig({
    ...createDefaultConfiguration(),
    ...config
  });
}

export function resolveConfiguration<TConfig extends object>(
  layers: ConfigurationLayer<TConfig>
): TConfig {
  return deepFreeze({
    ...(layers.defaults ?? {}),
    ...(layers.client ?? {}),
    ...(layers.repository ?? {}),
    ...(layers.operation ?? {})
  }) as TConfig;
}

export function createRepository(options: RepositoryOptions): Repository {
  return new Repository(options);
}

export function createRepositoryRef(options: RepositoryRefOptions): RepositoryRef {
  return new RepositoryRef(options);
}

export class RepositoryFactory {
  public create(options: RepositoryOptions): Repository {
    return new Repository(options);
  }
}

export class Repository implements RepositoryContract {
  readonly #extensions: Readonly<Record<string, unknown>>;
  readonly #info: RepositoryInfo;
  readonly #services: RepositoryCapabilityServices;
  #state: RepositoryLifecycleState = "active";

  public readonly capabilities: CapabilityMap;
  public readonly identity: RepositoryIdentity;

  public constructor(options: RepositoryOptions) {
    validateRepositoryInfo(options.info);
    validateCapabilityMap(options.capabilities ?? {});
    validateExtensions(options.extensions ?? {});

    this.#info = deepFreeze(options.info) as RepositoryInfo;
    this.identity = this.#info.identity;
    this.capabilities = deepFreeze(options.capabilities ?? {}) as CapabilityMap;
    this.#extensions = Object.freeze({ ...(options.extensions ?? {}) });
    this.#services = createRepositoryCapabilityServices(
      options.services ?? {},
      this.identity,
      this.capabilities
    );
  }

  public get extensions(): Readonly<Record<string, unknown>> {
    return this.#extensions;
  }

  public get info(): RepositoryInfo {
    return this.#info;
  }

  public get state(): RepositoryLifecycleState {
    return this.#state;
  }

  public async dispose(): Promise<void> {
    this.#state = "disposed";
  }

  public ref(reference: ReferenceName | Reference): RepositoryRef {
    this.ensureActive();

    return new RepositoryRef({
      capabilities: this.capabilities,
      reference,
      repository: this.identity,
      services: this.#services
    });
  }

  public ensureActive(): void {
    if (this.#state === "disposed") {
      throw new RepositoryError("Repository has been disposed", {
        diagnostics: {
          operation: { operation: "repository.lifecycle" },
          repository: formatRepositoryDiagnostics(this.identity)
        },
        retryability: "Never"
      });
    }
  }
}

export class RepositoryRef implements RepositoryRefContract {
  public readonly branches: BranchesCapability;
  public readonly files: FilesCapability;
  public readonly history: HistoryCapability;
  public readonly issues?: IssuesCapability;
  public readonly pullRequests?: PullRequestsCapability;
  public readonly reference: Reference;
  public readonly releases: ReleasesCapability;
  public readonly repository: RepositoryIdentity;
  public readonly search: SearchCapability;
  public readonly tags: TagsCapability;
  public readonly tree: TreeCapability;

  public constructor(options: RepositoryRefOptions) {
    validateRepositoryIdentity(options.repository);
    validateCapabilityMap(options.capabilities);

    this.repository = deepFreeze(options.repository) as RepositoryIdentity;
    this.reference = normalizeReference(options.reference, this.repository);

    const services = createRepositoryCapabilityServices(
      options.services ?? {},
      this.repository,
      options.capabilities
    );

    this.files = services.files;
    this.tree = services.tree;
    this.history = services.history;
    this.search = services.search;
    this.branches = services.branches;
    this.tags = services.tags;
    this.releases = services.releases;
    this.issues = services.issues;
    this.pullRequests = services.pullRequests;

    Object.freeze(this);
  }

  public readme(options?: OperationOptions): Promise<string> {
    return this.files.readText("README.md", options);
  }
}

export class GitBridgeClient {
  readonly #capabilityRegistry: CapabilityRegistry;
  readonly #config: GitBridgeResolvedConfig;
  readonly #context: GitBridgeRuntimeContext;
  readonly #ownsCache: boolean;
  readonly #providerRegistry: ProviderRegistry;
  #state: GitBridgeLifecycleState = "active";

  public constructor(config: GitBridgeClientConfig = {}) {
    validateClientConfig(config);

    const resolved = resolveGitBridgeConfig(config);
    this.#ownsCache = config.cache === undefined;
    this.#providerRegistry = new ProviderRegistry(resolved.providers);
    this.#capabilityRegistry = new CapabilityRegistry([
      ...resolved.capabilities,
      ...this.#providerRegistry
        .all()
        .flatMap((provider) => capabilityMapToDescriptors(provider.info.capabilities))
    ]);
    this.#config = freezeResolvedConfig({
      ...resolved,
      capabilities: this.#capabilityRegistry.all(),
      providers: this.#providerRegistry.all()
    });
    this.#context = freezeRuntimeContext({
      cache: this.#config.cache,
      capabilities: this.capabilities,
      diagnostics: this.#config.diagnostics,
      metadata: this.#config.metadata,
      metrics: this.#config.metrics,
      providers: this.providers,
      tracer: this.#config.tracer,
      transport: this.#config.transport
    });
  }

  public get capabilities(): CapabilityRegistryView {
    return this.#capabilityRegistry.view;
  }

  public get config(): GitBridgeResolvedConfig {
    return this.#config;
  }

  public get context(): GitBridgeRuntimeContext {
    return this.#context;
  }

  public get diagnostics(): DiagnosticsService {
    return this.#config.diagnostics;
  }

  public get providers(): ProviderRegistryView {
    return this.#providerRegistry.view;
  }

  public get state(): GitBridgeLifecycleState {
    return this.#state;
  }

  public async dispose(): Promise<void> {
    if (this.#state === "disposed") {
      return;
    }

    this.#state = "disposed";

    if (this.#ownsCache) {
      await this.#config.cache.dispose();
    }
  }

  public ensureActive(): void {
    if (this.#state === "disposed") {
      throw new ConfigurationError("GitBridge client has been disposed", {
        diagnostics: { operation: { operation: "client.lifecycle" } },
        retryability: "Never"
      });
    }
  }
}

function createRepositoryCapabilityServices(
  services: Partial<RepositoryCapabilityServices>,
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): RepositoryCapabilityServices {
  const deferred = createDeferredCapabilityServices(repository, capabilities);
  const resolved: RepositoryCapabilityServices = {
    branches: services.branches ?? deferred.branches,
    files: services.files ?? deferred.files,
    history: services.history ?? deferred.history,
    search: services.search ?? deferred.search,
    tags: services.tags ?? deferred.tags,
    tree: services.tree ?? deferred.tree,
    releases: services.releases ?? deferred.releases,
    issues: services.issues ?? deferred.issues,
    pullRequests: services.pullRequests ?? deferred.pullRequests
  };

  return Object.freeze(resolved);
}

function createDeferredCapabilityServices(
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): RepositoryCapabilityServices {
  return Object.freeze({
    branches: createDeferredBranchesCapability(repository, capabilities),
    files: createDeferredFilesCapability(repository, capabilities),
    history: createDeferredHistoryCapability(repository, capabilities),
    issues: createDeferredIssuesCapability(repository, capabilities),
    pullRequests: createDeferredPullRequestsCapability(repository, capabilities),
    releases: createDeferredReleasesCapability(repository, capabilities),
    search: createDeferredSearchCapability(repository, capabilities),
    tags: createDeferredTagsCapability(repository, capabilities),
    tree: createDeferredTreeCapability(repository, capabilities)
  });
}

function createDeferredFilesCapability(
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): FilesCapability {
  return Object.freeze({
    download(path: FilePath, _options?: DownloadOptions): Promise<Blob> {
      validatePath(path);
      return rejectDeferred("files", repository, capabilities);
    },
    exists(path: FilePath, _options?: OperationOptions): Promise<boolean> {
      validatePath(path);
      return rejectDeferred("files", repository, capabilities);
    },
    metadata(path: FilePath, _options?: OperationOptions): Promise<FileInfo> {
      validatePath(path);
      return rejectDeferred("files", repository, capabilities);
    },
    readBinary(path: FilePath, _options?: ReadBinaryOptions): Promise<Uint8Array> {
      validatePath(path);
      return rejectDeferred("files", repository, capabilities);
    },
    readJson<TValue extends JsonValue = JsonValue>(
      path: FilePath,
      _options?: ReadFileOptions
    ): Promise<TValue> {
      validatePath(path);
      return rejectDeferred("files", repository, capabilities);
    },
    readText(path: FilePath, _options?: ReadFileOptions): Promise<string> {
      validatePath(path);
      return rejectDeferred("files", repository, capabilities);
    },
    stream(path: FilePath, _options?: OperationOptions): Promise<AsyncIterable<Uint8Array>> {
      validatePath(path);
      return rejectDeferred("files", repository, capabilities);
    }
  });
}

function createDeferredTreeCapability(
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): TreeCapability {
  return Object.freeze({
    get(path: FilePath, _options?: OperationOptions): Promise<TreeNode> {
      validatePath(path);
      return rejectDeferred("tree", repository, capabilities);
    },
    list(path?: FilePath, _options?: TreeListOptions): Promise<readonly TreeNode[]> {
      validateOptionalPath(path);
      return rejectDeferred("tree", repository, capabilities);
    },
    tree(path?: FilePath, _options?: TreeListOptions): Promise<Tree> {
      validateOptionalPath(path);
      return rejectDeferred("tree", repository, capabilities);
    },
    walk(_options?: TreeWalkOptions): AsyncIterable<TreeNode> {
      return rejectDeferredIterable("tree", repository, capabilities);
    }
  });
}

function createDeferredSearchCapability(
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): SearchCapability {
  return Object.freeze({
    query<TItem = FileInfo>(query: SearchQuery): Promise<PagedResult<SearchResult<TItem>>> {
      assertNonEmpty(query.text, "Search query text must be a non-empty string");
      return rejectDeferred("search", repository, capabilities);
    },
    text(
      query: string,
      _options?: TextSearchOptions
    ): Promise<PagedResult<SearchResult<FileInfo>>> {
      assertNonEmpty(query, "Search query text must be a non-empty string");
      return rejectDeferred("search", repository, capabilities);
    }
  });
}

function createDeferredHistoryCapability(
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): HistoryCapability {
  return Object.freeze({
    file(path: FilePath, _options?: FileHistoryOptions): Promise<PagedResult<Commit>> {
      validatePath(path);
      return rejectDeferred("history", repository, capabilities);
    },
    get(sha: string, _options?: OperationOptions): Promise<Commit> {
      assertNonEmpty(sha, "Commit sha must be a non-empty string");
      return rejectDeferred("history", repository, capabilities);
    },
    list(_options?: CommitListOptions): Promise<PagedResult<Commit>> {
      return rejectDeferred("history", repository, capabilities);
    }
  });
}

function createDeferredBranchesCapability(
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): BranchesCapability {
  return Object.freeze({
    get(name: string, _options?: OperationOptions): Promise<Branch> {
      assertNonEmpty(name, "Branch name must be a non-empty string");
      return rejectDeferred("branches", repository, capabilities);
    },
    list(_options?: BranchListOptions): Promise<PagedResult<Branch>> {
      return rejectDeferred("branches", repository, capabilities);
    }
  });
}

function createDeferredTagsCapability(
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): TagsCapability {
  return Object.freeze({
    get(name: TagName, _options?: OperationOptions): Promise<Tag> {
      assertNonEmpty(name, "Tag name must be a non-empty string");
      return rejectDeferred("tags", repository, capabilities);
    },
    list(_options?: TagListOptions): Promise<PagedResult<Tag>> {
      return rejectDeferred("tags", repository, capabilities);
    }
  });
}

function createDeferredReleasesCapability(
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): ReleasesCapability {
  return Object.freeze({
    get(tagName: TagName, _options?: OperationOptions): Promise<Release> {
      assertNonEmpty(tagName, "Release tag name must be a non-empty string");
      return rejectDeferred("releases", repository, capabilities);
    },
    list(_options?: ReleaseListOptions): Promise<PagedResult<Release>> {
      return rejectDeferred("releases", repository, capabilities);
    }
  });
}

function createDeferredIssuesCapability(
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): IssuesCapability {
  return Object.freeze({
    get(number: number, _options?: OperationOptions): Promise<Issue> {
      validatePositiveNumber(number, "Issue number must be a positive number");
      return rejectDeferred("issues", repository, capabilities);
    },
    list(_options?: IssueListOptions): Promise<PagedResult<Issue>> {
      return rejectDeferred("issues", repository, capabilities);
    }
  });
}

function createDeferredPullRequestsCapability(
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): PullRequestsCapability {
  return Object.freeze({
    get(number: number, _options?: OperationOptions): Promise<PullRequest> {
      validatePositiveNumber(number, "Pull request number must be a positive number");
      return rejectDeferred("pullRequests", repository, capabilities);
    },
    list(_options?: PullRequestListOptions): Promise<PagedResult<PullRequest>> {
      return rejectDeferred("pullRequests", repository, capabilities);
    }
  });
}

async function rejectDeferred<TValue>(
  capability: keyof CapabilityMap,
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): Promise<TValue> {
  const descriptor = capabilities[capability];
  const message =
    descriptor?.status === "supported" || descriptor?.status === "partial"
      ? "Repository capability execution is not bound"
      : "Repository capability is not supported";

  throw new CapabilityNotSupportedError(message, {
    diagnostics: {
      operation: {
        capability,
        operation: `repository.${capability}`
      },
      repository: formatRepositoryDiagnostics(repository)
    },
    retryability: "Never"
  });
}

async function* rejectDeferredIterable<TValue>(
  capability: keyof CapabilityMap,
  repository: RepositoryIdentity,
  capabilities: CapabilityMap
): AsyncIterable<TValue> {
  await rejectDeferred<TValue>(capability, repository, capabilities);
}

function normalizeReference(
  reference: ReferenceName | Reference,
  repository: RepositoryIdentity
): Reference {
  if (typeof reference === "string") {
    assertNonEmpty(reference, "Repository reference must be a non-empty string");

    return deepFreeze({
      name: reference,
      repository,
      target: reference,
      type: "branch"
    }) as Reference;
  }

  validateReference(reference, repository);
  return deepFreeze(reference) as Reference;
}

function validateRepositoryInfo(info: RepositoryInfo): void {
  validateRepositoryIdentity(info.identity);
  assertNonEmpty(info.name, "Repository name must be a non-empty string");
  assertNonEmpty(info.fullName, "Repository full name must be a non-empty string");
  assertNonEmpty(info.url, "Repository URL must be a non-empty string");

  if (info.name !== info.identity.name) {
    throwValidation("Repository info name must match repository identity", {
      repository: formatRepositoryDiagnostics(info.identity)
    });
  }
}

function validateRepositoryIdentity(identity: RepositoryIdentity): void {
  assertNonEmpty(identity.provider, "Repository provider must be a non-empty string");
  assertNonEmpty(identity.owner, "Repository owner must be a non-empty string");
  assertNonEmpty(identity.name, "Repository name must be a non-empty string");
}

function validateReference(reference: Reference, repository: RepositoryIdentity): void {
  assertNonEmpty(reference.name, "Repository reference name must be a non-empty string");
  assertNonEmpty(reference.target, "Repository reference target must be a non-empty string");
  validateRepositoryIdentity(reference.repository);

  if (!sameRepositoryIdentity(reference.repository, repository)) {
    throwValidation("Repository reference identity must match repository identity", {
      repository: formatRepositoryDiagnostics(repository)
    });
  }
}

function validateCapabilityMap(capabilities: CapabilityMap): void {
  for (const [key, descriptor] of Object.entries(capabilities)) {
    if (descriptor === undefined) {
      continue;
    }

    validateCapability(descriptor);

    if (descriptor.name !== key) {
      throwValidation("Capability descriptor name must match capability key", {
        operation: { capability: key, operation: "repository.capability.validate" }
      });
    }
  }
}

function validateExtensions(extensions: Readonly<Record<string, unknown>>): void {
  for (const key of Object.keys(extensions)) {
    assertNonEmpty(key, "Repository extension keys must be non-empty strings");

    if (key in reservedExtensionKeys) {
      throwValidation("Repository extension key conflicts with a public repository member", {
        extra: { key }
      });
    }
  }
}

function validatePath(path: FilePath): void {
  assertNonEmpty(path, "Repository path must be a non-empty string");
}

function validateOptionalPath(path: FilePath | undefined): void {
  if (path !== undefined) {
    validatePath(path);
  }
}

function validatePositiveNumber(value: number, message: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throwValidation(message);
  }
}

function sameRepositoryIdentity(left: RepositoryIdentity, right: RepositoryIdentity): boolean {
  return left.provider === right.provider && left.owner === right.owner && left.name === right.name;
}

function formatRepositoryDiagnostics(
  identity: RepositoryIdentity
): NonNullable<ErrorDiagnostics["repository"]> {
  return {
    provider: identity.provider,
    repository: `${identity.owner}/${identity.name}`
  };
}

function throwValidation(message: string, diagnostics: ErrorDiagnostics = {}): never {
  throw new ValidationError(message, {
    diagnostics,
    retryability: "Never"
  });
}

const reservedExtensionKeys: Readonly<Record<string, true>> = Object.freeze({
  capabilities: true,
  dispose: true,
  extensions: true,
  identity: true,
  info: true,
  ref: true,
  state: true
});

class ProviderRegistry {
  readonly #providers = new Map<ProviderId, Provider>();
  readonly #view: ProviderRegistryView;

  public constructor(providers: readonly Provider[]) {
    for (const provider of providers) {
      this.register(provider);
    }

    this.#view = deepFreeze({
      all: () => this.all(),
      get: (id: ProviderId) => this.get(id),
      has: (id: ProviderId) => this.has(id),
      ids: () => this.ids(),
      require: (id: ProviderId) => this.require(id)
    }) as ProviderRegistryView;
  }

  public get view(): ProviderRegistryView {
    return this.#view;
  }

  public all(): readonly Provider[] {
    return deepFreeze([...this.#providers.values()]) as readonly Provider[];
  }

  public get(id: ProviderId): Provider | undefined {
    assertNonEmpty(id, "Provider id must be a non-empty string");
    return this.#providers.get(id);
  }

  public has(id: ProviderId): boolean {
    assertNonEmpty(id, "Provider id must be a non-empty string");
    return this.#providers.has(id);
  }

  public ids(): readonly ProviderId[] {
    return deepFreeze([...this.#providers.keys()]) as readonly ProviderId[];
  }

  public register(provider: Provider): Provider {
    validateProvider(provider);

    if (this.#providers.has(provider.info.id)) {
      throw new ConflictError("Provider is already registered", {
        diagnostics: {
          operation: { operation: "provider.registry.register" },
          provider: { provider: provider.info.id }
        },
        retryability: "Never"
      });
    }

    this.#providers.set(provider.info.id, provider);
    this.sort();
    return provider;
  }

  public require(id: ProviderId): Provider {
    const provider = this.get(id);

    if (provider === undefined) {
      throw new NotFoundError("Provider is not registered", {
        diagnostics: {
          operation: { operation: "provider.registry.require" },
          provider: { provider: id }
        },
        retryability: "Never"
      });
    }

    return provider;
  }

  private sort(): void {
    const sorted = [...this.#providers.values()].sort((left, right) => {
      const priority = (left.info.priority ?? 0) - (right.info.priority ?? 0);
      return priority === 0 ? left.info.id.localeCompare(right.info.id) : priority;
    });

    this.#providers.clear();

    for (const provider of sorted) {
      this.#providers.set(provider.info.id, provider);
    }
  }
}

class CapabilityRegistry {
  readonly #capabilities = new Map<string, CapabilityDescriptor>();
  readonly #view: CapabilityRegistryView;

  public constructor(capabilities: readonly CapabilityDescriptor[]) {
    for (const capability of capabilities) {
      this.register(capability);
    }

    this.#view = deepFreeze({
      all: () => this.all(),
      get: (name: string) => this.get(name),
      has: (name: string) => this.has(name),
      names: () => this.names(),
      require: (name: string) => this.require(name)
    }) as CapabilityRegistryView;
  }

  public get view(): CapabilityRegistryView {
    return this.#view;
  }

  public all(): readonly CapabilityDescriptor[] {
    return deepFreeze([...this.#capabilities.values()]) as readonly CapabilityDescriptor[];
  }

  public get(name: string): CapabilityDescriptor | undefined {
    assertNonEmpty(name, "Capability name must be a non-empty string");
    return this.#capabilities.get(name);
  }

  public has(name: string): boolean {
    assertNonEmpty(name, "Capability name must be a non-empty string");
    return this.#capabilities.has(name);
  }

  public names(): readonly string[] {
    return deepFreeze([...this.#capabilities.keys()]) as readonly string[];
  }

  public register(capability: CapabilityDescriptor): CapabilityDescriptor {
    validateCapability(capability);

    if (this.#capabilities.has(capability.name)) {
      throw new ConflictError("Capability is already registered", {
        diagnostics: {
          operation: {
            capability: capability.name,
            operation: "capability.registry.register"
          }
        },
        retryability: "Never"
      });
    }

    this.#capabilities.set(capability.name, deepFreeze(capability) as CapabilityDescriptor);
    return capability;
  }

  public require(name: string): CapabilityDescriptor {
    const capability = this.get(name);

    if (capability === undefined) {
      throw new NotFoundError("Capability is not registered", {
        diagnostics: {
          operation: { capability: name, operation: "capability.registry.require" }
        },
        retryability: "Never"
      });
    }

    return capability;
  }
}

function createDefaultConfiguration(): GitBridgeResolvedConfig {
  return {
    cache: createCacheRegistry(),
    capabilities: [],
    diagnostics: createNoopDiagnosticsService(),
    metrics: createNoopMetricCollector(),
    providers: [],
    tracer: createNoopTracer(),
    transport: createNoopTransport()
  };
}

function freezeResolvedConfig(config: GitBridgeResolvedConfig): GitBridgeResolvedConfig {
  return Object.freeze({
    ...config,
    capabilities: Object.freeze([...config.capabilities]),
    providers: Object.freeze([...config.providers])
  }) as GitBridgeResolvedConfig;
}

function freezeRuntimeContext(context: GitBridgeRuntimeContext): GitBridgeRuntimeContext {
  return Object.freeze(context) as GitBridgeRuntimeContext;
}

function capabilityMapToDescriptors(capabilities: CapabilityMap): readonly CapabilityDescriptor[] {
  return Object.values(capabilities).filter(
    (capability): capability is CapabilityDescriptor => capability !== undefined
  );
}

function validateClientConfig(config: GitBridgeClientConfig): void {
  for (const provider of config.providers ?? []) {
    validateProvider(provider);
  }

  for (const capability of config.capabilities ?? []) {
    validateCapability(capability);
  }
}

function validateProvider(provider: Provider): void {
  assertNonEmpty(provider.info.id, "Provider id must be a non-empty string");
  assertNonEmpty(provider.info.name, "Provider name must be a non-empty string");
}

function validateCapability(capability: CapabilityDescriptor): void {
  assertNonEmpty(capability.name, "Capability name must be a non-empty string");
}

function assertNonEmpty(value: string, message: string): void {
  if (value.trim() === "") {
    throw new ValidationError(message, {
      diagnostics: { operation: { operation: "core.validate" } },
      retryability: "Never"
    });
  }
}
