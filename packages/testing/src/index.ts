import type {
  Blob,
  Branch,
  CapabilityDescriptor,
  CapabilityMap,
  Commit,
  CreateSessionRequest,
  FileInfo,
  Issue,
  Provider,
  ProviderContext,
  ProviderInfo,
  ProviderMatch,
  ProviderSession,
  ProviderSessionCapabilities,
  PullRequest,
  PagedResult,
  Reference,
  Release,
  RepositoryIdentity,
  RepositoryInfo,
  RepositoryLocator,
  SearchResult,
  Tag,
  Tree,
  TreeNode
} from "@repoferry/contracts";
import { createRepoFerryClient } from "@repoferry/core";
import { CapabilityNotSupportedError, RepoFerryError, ProviderError } from "@repoferry/errors";
import { deepFreeze } from "@repoferry/shared";

export type ProviderCapabilityName = keyof CapabilityMap;

export type CertificationCheckStatus =
  "passed" | "failed" | "skipped-optional" | "unsupported-capability";

export type CertificationStatus = "passed" | "failed";

export type CertificationCheck = Readonly<{
  capability?: ProviderCapabilityName;
  message?: string;
  name: string;
  status: CertificationCheckStatus;
}>;

export type ProviderCertification = Readonly<{
  checks: readonly CertificationCheck[];
  provider: string;
  status: CertificationStatus;
}>;

export type CapabilityRequirement = "required" | "optional";

export type CapabilityTest = Readonly<{
  capability: ProviderCapabilityName;
  requirement: CapabilityRequirement;
  run?: (session: ProviderSession) => Promise<void> | void;
}>;

export type CapabilityTestMatrix = readonly CapabilityTest[];

export type ProviderContractSuiteOptions = Readonly<{
  capabilities?: CapabilityTestMatrix;
  context?: Partial<ProviderContext>;
  provider: Provider;
  repository: RepositoryLocator | RepositoryIdentity;
  unsupportedOptional?: Partial<Record<ProviderCapabilityName, () => Promise<unknown>>>;
}>;

export type FakeProviderOptions = Readonly<{
  info?: Partial<ProviderInfo>;
  match?: Partial<ProviderMatch>;
  session?: ProviderSession;
  supports?: (locator: RepositoryLocator) => Promise<ProviderMatch> | ProviderMatch;
}>;

export type FakeProviderSessionOptions = Readonly<{
  capabilities?: Partial<ProviderSessionCapabilities>;
  descriptors?: readonly CapabilityDescriptor[];
  provider?: Partial<ProviderInfo>;
  repository?: RepositoryInfo;
}>;

const requiredCapabilityNames = ["files", "tree", "history", "search"] as const;
const optionalCapabilityNames = ["branches", "tags", "releases", "issues", "pullRequests"] as const;

export const fixtures = deepFreeze({
  blob: createFixtureBlob(),
  branch: createFixtureBranch(),
  commit: createFixtureCommit(),
  fileInfo: createFixtureFileInfo(),
  issue: createFixtureIssue(),
  pullRequest: createFixturePullRequest(),
  reference: createFixtureReference(),
  release: createFixtureRelease(),
  repositoryIdentity: createFixtureRepositoryIdentity(),
  repositoryInfo: createFixtureRepositoryInfo(),
  searchResult: createFixtureSearchResult(),
  tag: createFixtureTag(),
  tree: createFixtureTree(),
  treeNode: createFixtureTreeNode()
});

export function createProviderCertification(
  provider: string,
  checks: readonly CertificationCheck[] = []
): ProviderCertification {
  const status = checks.some((check) => check.status === "failed") ? "failed" : "passed";
  return deepFreeze({ checks, provider, status }) as ProviderCertification;
}

export function createCapabilityTestMatrix(
  tests: readonly CapabilityTest[] = []
): CapabilityTestMatrix {
  const custom = new Map(tests.map((test) => [test.capability, test]));
  const matrix: CapabilityTest[] = [
    ...requiredCapabilityNames.map((capability) => ({
      capability,
      requirement: "required" as const
    })),
    ...optionalCapabilityNames.map((capability) => ({
      capability,
      requirement: "optional" as const
    }))
  ];

  return deepFreeze(
    matrix.map((test) => ({
      ...test,
      ...custom.get(test.capability)
    }))
  ) as CapabilityTestMatrix;
}

export async function runProviderContractSuite(
  options: ProviderContractSuiteOptions
): Promise<ProviderCertification> {
  const checks: CertificationCheck[] = [];
  const provider = options.provider;

  record(checks, "provider metadata", () => assertProviderInfo(provider.info));
  await recordAsync(checks, "provider registration compatibility", async () => {
    const client = createRepoFerryClient({ providers: [provider] });
    assert(client.providers.require(provider.info.id) === provider, "Provider was not registered");
    await client.dispose();
  });

  const locator = toLocator(options.repository);
  await recordAsync(checks, "provider matching", async () => {
    const match = await provider.supports(locator);
    assert(match.provider === provider.info.id, "Provider match id does not match provider info");
  });

  let session: ProviderSession | undefined;
  await recordAsync(checks, "session creation", async () => {
    session = await provider.createSession({
      context: createFakeProviderContext({ provider: provider.info, ...options.context }),
      repository: options.repository
    });
    assertProviderSession(session);
  });

  if (session !== undefined) {
    const activeSession = session;
    await recordAsync(checks, "session capability declaration", async () => {
      const descriptors = await activeSession.getCapabilities();
      for (const descriptor of descriptors) {
        assertCapabilityDescriptor(descriptor);
      }
    });

    await certifyCapabilities(
      checks,
      activeSession,
      options.capabilities ?? createCapabilityTestMatrix(),
      options.unsupportedOptional ?? {}
    );

    await recordAsync(checks, "session disposal", async () => {
      await activeSession.dispose();
      assert(activeSession.state === "disposed", "Provider session did not enter disposed state");
    });
  }

  return createProviderCertification(provider.info.id, checks);
}

export function createFakeProvider(options: FakeProviderOptions = {}): Provider {
  const info = createProviderInfo(options.info);
  const session =
    options.session ??
    createFakeProviderSession({
      descriptors: capabilityMapToDescriptors(info.capabilities),
      provider: info
    });

  return deepFreeze({
    info,
    async createSession(_request: CreateSessionRequest): Promise<ProviderSession> {
      return session;
    },
    async supports(locator: RepositoryLocator): Promise<ProviderMatch> {
      if (options.supports !== undefined) {
        return options.supports(locator);
      }

      return deepFreeze({
        confidence: "exact",
        provider: info.id,
        repository: createFixtureRepositoryIdentity({ provider: info.id }),
        ...options.match
      }) as ProviderMatch;
    }
  }) as Provider;
}

export function createFakeProviderSession(
  options: FakeProviderSessionOptions = {}
): ProviderSession {
  let state: ProviderSession["state"] = "active";
  const provider = createProviderInfo(options.provider);
  const repository = options.repository ?? createFixtureRepositoryInfo({ provider: provider.id });
  const descriptors = options.descriptors ?? capabilityMapToDescriptors(provider.capabilities);
  const capabilities = createFakeSessionCapabilities(repository.identity, options.capabilities);

  return {
    capabilities,
    provider,
    repository,
    get state() {
      return state;
    },
    async dispose() {
      state = "disposed";
    },
    async getCapabilities() {
      ensureActive(state);
      return descriptors;
    }
  };
}

export function createFakeProviderContext(input: Partial<ProviderContext> = {}): ProviderContext {
  const provider = input.provider ?? createProviderInfo();
  return deepFreeze({
    ...input,
    provider
  }) as ProviderContext;
}

export function assertProviderInfo(info: ProviderInfo): void {
  assertNonEmpty(info.id, "Provider id must be a non-empty string");
  assertNonEmpty(info.name, "Provider name must be a non-empty string");
  for (const [name, descriptor] of Object.entries(info.capabilities)) {
    if (descriptor !== undefined) {
      assert(descriptor.name === name, "Capability descriptor name must match capability key");
      assertCapabilityDescriptor(descriptor);
    }
  }
}

export function assertProviderSession(session: ProviderSession): void {
  assertProviderInfo(session.provider);
  assertRepositoryInfo(session.repository);
  assert(session.state === "active", "Provider session must be active after creation");
  assert(session.capabilities.files !== undefined, "Provider session must expose files");
  assert(session.capabilities.tree !== undefined, "Provider session must expose tree");
  assert(session.capabilities.history !== undefined, "Provider session must expose history");
  assert(session.capabilities.search !== undefined, "Provider session must expose search");
}

export function assertRepositoryIdentity(identity: RepositoryIdentity): void {
  assertNonEmpty(identity.provider, "Repository provider must be a non-empty string");
  assertNonEmpty(identity.owner, "Repository owner must be a non-empty string");
  assertNonEmpty(identity.name, "Repository name must be a non-empty string");
}

export function assertRepositoryInfo(info: RepositoryInfo): void {
  assertRepositoryIdentity(info.identity);
  assertNonEmpty(info.name, "Repository name must be a non-empty string");
  assertNonEmpty(info.fullName, "Repository full name must be a non-empty string");
  assertNonEmpty(info.url, "Repository URL must be a non-empty string");
}

export function assertReference(reference: Reference): void {
  assertRepositoryIdentity(reference.repository);
  assertNonEmpty(reference.name, "Reference name must be a non-empty string");
  assertNonEmpty(reference.target, "Reference target must be a non-empty string");
}

export function assertBranch(branch: Branch): void {
  assertReference(branch);
  assert(branch.type === "branch", "Branch type must be branch");
}

export function assertTag(tag: Tag): void {
  assertReference(tag);
  assert(tag.type === "tag", "Tag type must be tag");
}

export function assertCommit(commit: Commit): void {
  assertNonEmpty(commit.sha, "Commit sha must be a non-empty string");
  assertNonEmpty(commit.message, "Commit message must be a non-empty string");
  assertNonEmpty(commit.author.name, "Commit author name must be a non-empty string");
  assertNonEmpty(commit.tree, "Commit tree must be a non-empty string");
}

export function assertTreeNode(node: TreeNode): void {
  assertNonEmpty(node.path, "Tree node path must be a non-empty string");
  assertNonEmpty(node.name, "Tree node name must be a non-empty string");
}

export function assertTree(tree: Tree): void {
  assertNonEmpty(tree.sha, "Tree sha must be a non-empty string");
  assert(
    tree.nodes.every((node) => isValid(() => assertTreeNode(node))),
    "Tree node is invalid"
  );
}

export function assertBlob(blob: Blob): void {
  assertNonEmpty(blob.sha, "Blob sha must be a non-empty string");
  assertNonEmpty(blob.path, "Blob path must be a non-empty string");
  assert(blob.size >= 0, "Blob size must be non-negative");
}

export function assertFileInfo(file: FileInfo): void {
  assertNonEmpty(file.path, "File path must be a non-empty string");
  assertNonEmpty(file.name, "File name must be a non-empty string");
}

export function assertIssue(issue: Issue): void {
  assert(issue.number > 0, "Issue number must be positive");
  assertNonEmpty(issue.title, "Issue title must be a non-empty string");
}

export function assertPullRequest(pullRequest: PullRequest): void {
  assert(pullRequest.number > 0, "Pull request number must be positive");
  assertNonEmpty(pullRequest.title, "Pull request title must be a non-empty string");
  assertRepositoryIdentity(pullRequest.source.repository);
  assertRepositoryIdentity(pullRequest.target.repository);
}

export function assertRelease(release: Release): void {
  assertNonEmpty(release.tagName, "Release tag name must be a non-empty string");
}

export function assertPagedResult<TItem>(
  result: Readonly<{ items: readonly TItem[]; pageInfo: unknown }>
): void {
  assert(Array.isArray(result.items), "Paged result items must be an array");
  assert(result.pageInfo !== undefined, "Paged result pageInfo must be present");
}

export function assertRepoFerryError(error: unknown): asserts error is RepoFerryError {
  assert(error instanceof RepoFerryError, "Expected a RepoFerryError");
}

export function assertCapabilityNotSupported(
  error: unknown
): asserts error is CapabilityNotSupportedError {
  assert(error instanceof CapabilityNotSupportedError, "Expected a CapabilityNotSupportedError");
}

async function certifyCapabilities(
  checks: CertificationCheck[],
  session: ProviderSession,
  matrix: CapabilityTestMatrix,
  unsupportedOptional: Partial<Record<ProviderCapabilityName, () => Promise<unknown>>>
): Promise<void> {
  const declared = await session.getCapabilities();

  for (const test of matrix) {
    const descriptor = declared.find((capability) => capability.name === test.capability);
    const runtimeCapability = session.capabilities[test.capability];

    if (descriptor === undefined || descriptor.status === "unsupported") {
      if (test.requirement === "required") {
        checks.push(failedCheck(test, "Required capability is not supported"));
      } else {
        checks.push({
          capability: test.capability,
          name: `${test.capability} optional capability`,
          status: "unsupported-capability"
        });
      }
      await verifyUnsupportedOptional(checks, test, unsupportedOptional[test.capability]);
      continue;
    }

    if (runtimeCapability === undefined) {
      checks.push(failedCheck(test, "Supported capability is not exposed on the session"));
      continue;
    }

    if (test.run === undefined) {
      checks.push({
        capability: test.capability,
        name: `${test.capability} capability declaration`,
        status: test.requirement === "optional" ? "skipped-optional" : "passed"
      });
      continue;
    }

    await recordAsync(
      checks,
      `${test.capability} capability behavior`,
      () => test.run?.(session),
      test.capability
    );
  }
}

async function verifyUnsupportedOptional(
  checks: CertificationCheck[],
  test: CapabilityTest,
  operation: (() => Promise<unknown>) | undefined
): Promise<void> {
  if (test.requirement !== "optional" || operation === undefined) {
    return;
  }

  try {
    await operation();
    checks.push(failedCheck(test, "Unsupported optional capability operation did not reject"));
  } catch (error: unknown) {
    try {
      assertCapabilityNotSupported(error);
      checks.push({
        capability: test.capability,
        name: `${test.capability} unsupported behavior`,
        status: "passed"
      });
    } catch (assertionError: unknown) {
      checks.push(failedCheck(test, getErrorMessage(assertionError)));
    }
  }
}

function createFakeSessionCapabilities(
  repository: RepositoryIdentity,
  overrides: Partial<ProviderSessionCapabilities> = {}
): ProviderSessionCapabilities {
  return deepFreeze({
    branches: overrides.branches ?? {
      async get(name: string) {
        return createFixtureBranch({ name, repository });
      },
      async list() {
        return createPage([createFixtureBranch({ repository })]);
      }
    },
    files: overrides.files ?? {
      async download(path: string) {
        return createFixtureBlob({ path });
      },
      async exists() {
        return true;
      },
      async metadata(path: string) {
        return createFixtureFileInfo({ path });
      },
      async getMetadata(path: string) {
        return createFixtureFileInfo({ path });
      },
      async readBinary() {
        return new TextEncoder().encode("fixture");
      },
      async readJson<TValue>() {
        return { ok: true } as TValue;
      },
      async readText() {
        return "fixture";
      },
      async stream() {
        return (async function* streamFixture() {
          yield new TextEncoder().encode("fixture");
        })();
      }
    },
    history: overrides.history ?? {
      async file() {
        return createPage([createFixtureCommit()]);
      },
      async get(sha: string) {
        return createFixtureCommit({ sha });
      },
      async list() {
        return createPage([createFixtureCommit()]);
      }
    },
    issues: overrides.issues ?? {
      async get(number: number) {
        return createFixtureIssue({ number });
      },
      async list() {
        return createPage([createFixtureIssue()]);
      }
    },
    pullRequests: overrides.pullRequests ?? {
      async get(number: number) {
        return createFixturePullRequest({
          number,
          source: { branch: "feature", repository, sha: "head-sha" },
          target: { branch: "main", repository, sha: "base-sha" }
        });
      },
      async list() {
        return createPage([
          createFixturePullRequest({
            source: { branch: "feature", repository, sha: "head-sha" },
            target: { branch: "main", repository, sha: "base-sha" }
          })
        ]);
      }
    },
    releases: overrides.releases ?? {
      async get(tagName: string) {
        return createFixtureRelease({ tagName });
      },
      async list() {
        return createPage([createFixtureRelease()]);
      }
    },
    search: overrides.search ?? {
      async query<TItem>() {
        const result = {
          item: createFixtureFileInfo() as TItem,
          kind: "file",
          score: 1
        } as SearchResult<TItem>;
        return createPage([result]);
      },
      async text() {
        return createPage([createFixtureSearchResult()]);
      }
    },
    tags: overrides.tags ?? {
      async get(name: string) {
        return createFixtureTag({ name, repository });
      },
      async list() {
        return createPage([createFixtureTag({ repository })]);
      }
    },
    tree: overrides.tree ?? {
      async get(path: string) {
        return createFixtureTreeNode({ path });
      },
      async list() {
        return [createFixtureTreeNode()];
      },
      async tree(path = "") {
        return createFixtureTree({ path });
      },
      async *walk() {
        yield createFixtureTreeNode();
      }
    }
  }) as ProviderSessionCapabilities;
}

function createProviderInfo(input: Partial<ProviderInfo> = {}): ProviderInfo {
  const capabilities = input.capabilities ?? createCapabilityMap();
  return deepFreeze({
    capabilities,
    id: "fake",
    name: "Fake Provider",
    version: "0.0.0",
    ...input
  }) as ProviderInfo;
}

function createCapabilityMap(
  names: readonly ProviderCapabilityName[] = [
    ...requiredCapabilityNames,
    ...optionalCapabilityNames
  ]
): CapabilityMap {
  return deepFreeze(
    Object.fromEntries(
      names.map((name) => [
        name,
        {
          name,
          operations: [],
          status: "supported"
        } satisfies CapabilityDescriptor
      ])
    )
  ) as CapabilityMap;
}

function createFixtureRepositoryIdentity(
  input: Partial<RepositoryIdentity> = {}
): RepositoryIdentity {
  return deepFreeze({
    name: "project",
    owner: "acme",
    provider: "fake",
    ...input
  }) as RepositoryIdentity;
}

function createFixtureRepositoryInfo(
  input: Partial<RepositoryInfo & RepositoryIdentity> = {}
): RepositoryInfo {
  const identity = createFixtureRepositoryIdentity(input);
  const { identity: _identity, ...rest } = input;
  return deepFreeze({
    fullName: `${identity.owner}/${identity.name}`,
    name: identity.name,
    owner: { username: identity.owner },
    url: `https://example.com/${identity.owner}/${identity.name}`,
    visibility: "public",
    ...rest,
    identity
  }) as RepositoryInfo;
}

function createFixtureReference(input: Partial<Reference> = {}): Reference {
  const repository = input.repository ?? createFixtureRepositoryIdentity();
  return deepFreeze({
    name: "main",
    repository,
    target: "abc123",
    type: "branch",
    ...input
  }) as Reference;
}

function createFixtureBranch(input: Partial<Branch> = {}): Branch {
  return deepFreeze({
    ...createFixtureReference({ ...input, type: "branch" }),
    default: true,
    name: input.name ?? "main",
    type: "branch"
  }) as Branch;
}

function createFixtureTag(input: Partial<Tag> = {}): Tag {
  return deepFreeze({
    ...createFixtureReference({ ...input, name: input.name ?? "v1.0.0", type: "tag" }),
    name: input.name ?? "v1.0.0",
    type: "tag"
  }) as Tag;
}

function createFixtureCommit(input: Partial<Commit> = {}): Commit {
  return deepFreeze({
    author: { name: "Ada", email: "ada@example.com" },
    message: "Initial commit",
    parents: [],
    sha: "abc123",
    tree: "tree-sha",
    ...input
  }) as Commit;
}

function createFixtureTreeNode(input: Partial<TreeNode> = {}): TreeNode {
  const path = input.path ?? "README.md";
  return deepFreeze({
    name: path.split("/").pop() ?? path,
    path,
    sha: "blob-sha",
    type: "file",
    ...input
  }) as TreeNode;
}

function createFixtureTree(input: Partial<Tree> = {}): Tree {
  return deepFreeze({
    nodes: [createFixtureTreeNode()],
    path: "",
    sha: "tree-sha",
    ...input
  }) as Tree;
}

function createFixtureBlob(input: Partial<Blob> = {}): Blob {
  return deepFreeze({
    content: "fixture",
    encoding: "utf-8",
    path: "README.md",
    sha: "blob-sha",
    size: 7,
    ...input
  }) as Blob;
}

function createFixtureFileInfo(input: Partial<FileInfo> = {}): FileInfo {
  const path = input.path ?? "README.md";
  return deepFreeze({
    name: path.split("/").pop() ?? path,
    path,
    sha: "blob-sha",
    size: 7,
    ...input
  }) as FileInfo;
}

function createFixtureIssue(input: Partial<Issue> = {}): Issue {
  return deepFreeze({
    number: 1,
    state: "open",
    title: "Fixture issue",
    ...input
  }) as Issue;
}

function createFixturePullRequest(input: Partial<PullRequest> = {}): PullRequest {
  const repository = input.source?.repository ?? createFixtureRepositoryIdentity();
  return deepFreeze({
    number: 1,
    source: { branch: "feature", repository, sha: "head-sha" },
    state: "open",
    target: { branch: "main", repository, sha: "base-sha" },
    title: "Fixture pull request",
    ...input
  }) as PullRequest;
}

function createFixtureRelease(input: Partial<Release> = {}): Release {
  return deepFreeze({
    state: "published",
    tagName: "v1.0.0",
    ...input
  }) as Release;
}

function createFixtureSearchResult(): SearchResult<FileInfo> {
  return deepFreeze({
    item: createFixtureFileInfo(),
    kind: "file",
    score: 1
  }) as SearchResult<FileInfo>;
}

function createPage<TItem>(items: readonly TItem[]): PagedResult<TItem> {
  return deepFreeze({
    items,
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false
    }
  }) as PagedResult<TItem>;
}

function toLocator(repository: RepositoryLocator | RepositoryIdentity): RepositoryLocator {
  if ("url" in repository) {
    return repository;
  }

  return {
    url: `https://example.com/${repository.owner}/${repository.name}`
  };
}

function capabilityMapToDescriptors(capabilities: CapabilityMap): readonly CapabilityDescriptor[] {
  return Object.values(capabilities).filter(
    (capability): capability is CapabilityDescriptor => capability !== undefined
  );
}

function assertCapabilityDescriptor(descriptor: CapabilityDescriptor): void {
  assertNonEmpty(descriptor.name, "Capability name must be a non-empty string");
  assert(
    descriptor.status === "supported" ||
      descriptor.status === "unsupported" ||
      descriptor.status === "partial",
    "Capability status must be supported, unsupported, or partial"
  );
}

function ensureActive(state: ProviderSession["state"]): void {
  if (state === "disposed") {
    throw new ProviderError("Fake provider session has been disposed", {
      retryability: "Never"
    });
  }
}

function failedCheck(test: CapabilityTest, message: string): CertificationCheck {
  return {
    capability: test.capability,
    message,
    name: `${test.capability} capability`,
    status: "failed"
  };
}

function record(checks: CertificationCheck[], name: string, run: () => void): void {
  try {
    run();
    checks.push({ name, status: "passed" });
  } catch (error: unknown) {
    checks.push({ message: getErrorMessage(error), name, status: "failed" });
  }
}

async function recordAsync(
  checks: CertificationCheck[],
  name: string,
  run: () => Promise<void> | void,
  capability?: ProviderCapabilityName
): Promise<void> {
  try {
    await run();
    checks.push({
      ...(capability === undefined ? {} : { capability }),
      name,
      status: "passed"
    });
  } catch (error: unknown) {
    checks.push({
      ...(capability === undefined ? {} : { capability }),
      message: getErrorMessage(error),
      name,
      status: "failed"
    });
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNonEmpty(value: string, message: string): void {
  assert(value.trim().length > 0, message);
}

function isValid(validate: () => void): boolean {
  try {
    validate();
    return true;
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
