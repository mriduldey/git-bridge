import type {
  AuthenticationContext,
  AuthenticationStrategy,
  CreateSessionRequest,
  TokenCredentials,
  Transport,
  TransportContext,
  TransportRequest,
  TransportResponse
} from "@gitbridge/contracts";
import { GitBridgeClient, RepositoryFactory } from "@gitbridge/core";
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ProviderError,
  RateLimitError,
  ValidationError
} from "@gitbridge/errors";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  GitHubProvider,
  GitHubProviderCapabilities,
  GitHubProviderId,
  GitHubProviderSession,
  createGitHubClient,
  createGitHubProvider,
  createGitHubProviderConfig,
  githubProvider,
  githubTokenAuth,
  mapGitHubError,
  type GitHubClientConfig,
  type GitHubProviderConfig
} from "../src/index.js";
import * as publicApi from "../src/index.js";
import type {
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
} from "../src/github-models.js";
import {
  mapGitHubBranch,
  mapGitHubCommit,
  mapGitHubContentToBlob,
  mapGitHubContentToFileInfo,
  mapGitHubContentToTreeNode,
  mapGitHubIssue,
  mapGitHubPullRequest,
  mapGitHubRelease,
  mapGitHubRef,
  mapGitHubRepository,
  mapGitHubSearchItem,
  mapGitHubTag,
  mapGitHubTree
} from "../src/mappers.js";

describe("GitHub provider foundation", () => {
  it("declares provider metadata and foundation capabilities", () => {
    const provider = createGitHubProvider({ priority: 5 });

    expect(provider.info).toMatchObject({
      capabilities: GitHubProviderCapabilities,
      id: GitHubProviderId,
      name: "GitHub",
      priority: 5
    });
    expect(provider.info.capabilities.files?.status).toBe("supported");
    expect(provider.info.capabilities.search?.status).toBe("supported");
    expect(provider.info.capabilities.issues?.status).toBe("supported");
    expect(Object.isFrozen(provider.info)).toBe(true);
  });

  it("matches supported GitHub repository URLs without live API calls", async () => {
    const provider = createGitHubProvider();

    await expect(
      provider.supports({ url: "https://github.com/openai/codex.git" })
    ).resolves.toEqual(
      expect.objectContaining({
        confidence: "exact",
        provider: "github",
        repository: { name: "codex", owner: "openai", provider: "github" }
      })
    );
    await expect(provider.supports({ url: "https://gitlab.com/openai/codex" })).resolves.toEqual({
      confidence: "none",
      provider: "github"
    });
  });

  it("supports explicit enterprise GitHub hosts", async () => {
    const provider = createGitHubProvider({ hosts: ["github.example.com"] });

    await expect(
      provider.supports({ url: "https://github.example.com/acme/repo" })
    ).resolves.toMatchObject({
      confidence: "exact",
      repository: { name: "repo", owner: "acme", provider: "github" }
    });
  });

  it("integrates with Core provider registration and repository opening", async () => {
    const provider = createGitHubProvider({
      transport: createMockTransport({
        "/repos/openai/codex": createRepositoryModel()
      })
    });
    const client = new GitBridgeClient({ providers: [provider] });
    const repository = await client.open("https://github.com/openai/codex");

    expect(client.providers.require("github")).toBe(provider);
    expect(repository.identity).toEqual({ name: "codex", owner: "openai", provider: "github" });
    expect(repository.info.defaultBranch).toBe("main");
    expect(repository.capabilities.files?.status).toBe("supported");
  });

  it("creates sessions with injected authentication, transport, cache, and diagnostics", async () => {
    const transport = createMockTransport({ "/repos/openai/codex": createRepositoryModel() });
    const cache = createCacheProvider();
    const diagnostics = createDiagnostics();
    const authentication: AuthenticationStrategy = {
      type: "token",
      authenticate: vi.fn(async (): Promise<AuthenticationContext> => {
        const credentials: TokenCredentials = {
          kind: "access-token",
          provider: "github",
          token: "secret"
        };

        return {
          credentials,
          provider: "github",
          type: "token"
        };
      })
    };
    const provider = createGitHubProvider({
      cache,
      diagnostics,
      transport
    });
    const client = new GitBridgeClient({ authentication, providers: [provider] });

    const repository = await client.open("https://github.com/openai/codex", {
      correlationId: "corr-1"
    });
    expect(authentication.authenticate).toHaveBeenCalledWith({
      correlationId: "corr-1",
      provider: "github"
    });
    expect(transport.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer secret" }),
        method: "read",
        target: "/repos/openai/codex"
      }),
      expect.any(Object)
    );
    expect(repository.identity.provider).toBe("github");
  });

  it("creates provider sessions directly and preserves lifecycle with cache and diagnostics context", async () => {
    const cache = createCacheProvider();
    const diagnostics = createDiagnostics();
    const provider = createGitHubProvider({
      cache,
      diagnostics,
      transport: createMockTransport({ "/repos/openai/codex": createRepositoryModel() })
    });
    const session = await provider.createSession({
      context: { provider: provider.info },
      repository: { url: "https://github.com/openai/codex" }
    });

    expect(session).toBeInstanceOf(GitHubProviderSession);
    expect(session.state).toBe("active");
    expect((session as GitHubProviderSession).context.cache).toBe(cache);
    expect((session as GitHubProviderSession).context.diagnostics).toBe(diagnostics);
    expect(await session.getCapabilities()).toHaveLength(9);

    await session.dispose();
    await session.dispose();

    expect(session.state).toBe("disposed");
    expect(diagnostics.publish).toHaveBeenCalledTimes(1);
    await expect(session.getCapabilities()).rejects.toThrow(ProviderError);
    await expect(session.capabilities.files.readText("README.md")).rejects.toThrow(ProviderError);
  });

  it("executes foundational repository operations through mocked transport", async () => {
    const transport = createMockTransport({
      "/repos/openai/codex": createRepositoryModel(),
      "/repos/openai/codex/branches": [createBranchModel("main")],
      "/repos/openai/codex/branches/main": createBranchModel("main"),
      "/repos/openai/codex/commits": [createCommitModel("abc123")],
      "/repos/openai/codex/commits/abc123": createCommitModel("abc123"),
      "/repos/openai/codex/commits?path=README.md": [createCommitModel("abc123")],
      "/repos/openai/codex/contents": [createContentModel("README.md")],
      "/repos/openai/codex/contents/README.md": createContentModel("README.md", "# Hello"),
      "/repos/openai/codex/git/ref/tags/v1.0.0": createTagRefModel("v1.0.0"),
      "/repos/openai/codex/git/refs/tags": [createTagRefModel("v1.0.0")],
      "/repos/openai/codex/git/trees/HEAD": createTreeModel(),
      "/repos/openai/codex/issues?page=2&per_page=1": {
        data: [createIssueModel(1)],
        headers: { link: '<https://api.github.com/repositories?page=3>; rel="next"' }
      },
      "/repos/openai/codex/issues/1": createIssueModel(1),
      "/repos/openai/codex/pulls": [createPullRequestModel(2)],
      "/repos/openai/codex/pulls/2": createPullRequestModel(2),
      "/repos/openai/codex/releases": [createReleaseModel("v1.0.0")],
      "/repos/openai/codex/releases/tags/v1.0.0": createReleaseModel("v1.0.0"),
      "/search/code?q=hello%20repo%3Aopenai%2Fcodex": createSearchModel()
    });
    const provider = createGitHubProvider({ transport });
    const session = await provider.createSession({
      context: { provider: provider.info },
      repository: { url: "https://github.com/openai/codex" }
    });
    const repository = await new RepositoryFactory().createFromSession(session);
    const ref = repository.ref("main");

    expect(repository.identity).toEqual({ name: "codex", owner: "openai", provider: "github" });
    await expect(ref.files.readText("README.md")).resolves.toBe("# Hello");
    await expect(ref.files.readBinary("README.md")).resolves.toBeInstanceOf(Uint8Array);
    await expect(ref.files.readJson("README.md")).rejects.toThrow(SyntaxError);
    await expect(ref.files.exists("README.md")).resolves.toBe(true);
    await expect(ref.files.metadata("README.md")).resolves.toMatchObject({
      name: "README.md",
      path: "README.md"
    });
    await expect(ref.files.getMetadata("README.md")).resolves.toMatchObject({
      name: "README.md",
      path: "README.md"
    });
    await expect(ref.files.download("README.md")).resolves.toMatchObject({
      path: "README.md",
      sha: "blob-sha"
    });
    await expect(ref.tree.list()).resolves.toEqual([
      expect.objectContaining({ name: "README.md", type: "file" })
    ]);
    await expect(ref.tree.get("README.md")).resolves.toMatchObject({
      path: "README.md",
      type: "file"
    });
    await expect(ref.tree.tree()).resolves.toMatchObject({
      nodes: [expect.objectContaining({ path: "README.md" })],
      sha: "tree-sha"
    });
    await expect(ref.history.list()).resolves.toMatchObject({
      items: [expect.objectContaining({ sha: "abc123" })]
    });
    expect(ref.commits).toBe(ref.history);
    await expect(ref.history.get("abc123")).resolves.toMatchObject({ sha: "abc123" });
    await expect(ref.history.file("README.md")).resolves.toMatchObject({
      items: [expect.objectContaining({ sha: "abc123" })]
    });
    await expect(ref.branches.list()).resolves.toMatchObject({
      items: [expect.objectContaining({ name: "main" })]
    });
    await expect(ref.branches.get("main")).resolves.toMatchObject({ name: "main" });
    await expect(ref.tags.list()).resolves.toMatchObject({
      items: [expect.objectContaining({ name: "v1.0.0" })]
    });
    await expect(ref.tags.get("v1.0.0")).resolves.toMatchObject({ name: "v1.0.0" });
    await expect(ref.issues?.list({ cursor: "2", limit: 1 })).resolves.toMatchObject({
      items: [expect.objectContaining({ number: 1 })],
      pageInfo: { endCursor: "3", hasNextPage: true }
    });
    await expect(ref.issues?.get(1)).resolves.toMatchObject({ number: 1 });
    await expect(ref.pullRequests?.list()).resolves.toMatchObject({
      items: [expect.objectContaining({ number: 2 })]
    });
    await expect(ref.pullRequests?.get(2)).resolves.toMatchObject({ number: 2 });
    await expect(ref.releases.list()).resolves.toMatchObject({
      items: [expect.objectContaining({ tagName: "v1.0.0" })]
    });
    await expect(ref.releases.get("v1.0.0")).resolves.toMatchObject({ tagName: "v1.0.0" });
    await expect(ref.search.text("hello")).resolves.toMatchObject({
      items: [expect.objectContaining({ kind: "file" })]
    });
  });

  it("normalizes data-only adapter responses for repository readText", async () => {
    const transport = createDataResponseTransport({
      "/repos/openai/codex": createRepositoryModel(),
      "/repos/openai/codex/contents/docs/planning/ROADMAP.md": createContentModel(
        "docs/planning/ROADMAP.md",
        "# Roadmap"
      )
    });
    const client = createGitHubClient({ transport });

    try {
      const repository = await client.open("https://github.com/openai/codex");

      await expect(repository.readText("docs/planning/ROADMAP.md")).resolves.toBe("# Roadmap");

      await repository.dispose();
    } finally {
      await client.dispose();
    }
  });

  it("expresses provider requests through GitBridge transport", async () => {
    const transportCalls: Array<readonly [TransportRequest, TransportContext | undefined]> = [];
    const transport: Transport = {
      async execute<TBody = unknown>(
        request: TransportRequest,
        context?: TransportContext
      ): Promise<TransportResponse<TBody>> {
        transportCalls.push([request, context]);
        return {
          body: createRepositoryModel() as TBody,
          headers: { request: "1" },
          status: 200
        };
      }
    };
    const credentials: TokenCredentials = { kind: "access-token", token: "secret" };
    const provider = createGitHubProvider({ transport });
    const session = await provider.createSession({
      context: {
        authenticationContext: {
          credentials,
          type: "token"
        },
        provider: provider.info
      },
      repository: { url: "https://github.com/openai/codex" }
    });

    expect(session.repository.identity).toEqual({
      name: "codex",
      owner: "openai",
      provider: "github"
    });
    expect(transportCalls[0]?.[0]).toMatchObject({
      headers: expect.objectContaining({ authorization: "Bearer secret" }),
      method: "read",
      target: "/repos/openai/codex"
    });
    expect(transportCalls[0]?.[1]).toEqual({});
  });

  it("maps GitHub provider failures to approved GitBridge errors", () => {
    expect(mapGitHubError({ status: 401 })).toBeInstanceOf(AuthenticationError);
    expect(mapGitHubError({ status: 403 })).toBeInstanceOf(AuthorizationError);
    expect(
      mapGitHubError({ headers: { "x-ratelimit-remaining": "0" }, status: 403 })
    ).toBeInstanceOf(RateLimitError);
    expect(mapGitHubError({ status: 404 })).toBeInstanceOf(NotFoundError);
    expect(mapGitHubError({ status: 409 })).toBeInstanceOf(ConflictError);
    expect(mapGitHubError({ status: 502 })).toBeInstanceOf(ProviderError);
    expect(mapGitHubError(new Error("boom")).cause).toBeInstanceOf(Error);
  });

  it("rejects invalid provider configuration and unsupported locators", async () => {
    expect(() => createGitHubProvider({ hosts: [] })).toThrow(ValidationError);

    const provider = createGitHubProvider({
      transport: createMockTransport({ "/repos/openai/codex": createRepositoryModel() })
    });

    await expect(
      provider.createSession({
        context: { provider: provider.info },
        repository: { url: "https://github.com/openai" }
      })
    ).rejects.toThrow(ValidationError);
  });
});

describe("GitHub mappers", () => {
  const repository = { name: "codex", owner: "openai", provider: "github" };

  it("maps repository, branch, ref, and tag models", () => {
    expect(mapGitHubRepository(createRepositoryModel(), repository)).toMatchObject({
      defaultBranch: "main",
      fullName: "openai/codex",
      visibility: "public"
    });
    expect(mapGitHubBranch(createBranchModel("main"), repository)).toMatchObject({
      name: "main",
      target: "abc123",
      type: "branch"
    });
    expect(mapGitHubRef(createTagRefModel("v1.0.0"), repository)).toMatchObject({
      name: "v1.0.0",
      type: "tag"
    });
    expect(mapGitHubTag(createTagRefModel("v1.0.0"), repository)).toMatchObject({
      name: "v1.0.0",
      type: "tag"
    });
  });

  it("maps commits, trees, blobs, file metadata, and advanced API models", () => {
    expect(mapGitHubCommit(createCommitModel("abc123"))).toMatchObject({
      author: { name: "Ada" },
      sha: "abc123",
      tree: "tree-sha"
    });
    expect(mapGitHubTree(createTreeModel())).toMatchObject({
      nodes: [expect.objectContaining({ path: "README.md", type: "file" })],
      sha: "tree-sha"
    });
    expect(mapGitHubContentToFileInfo(createContentModel("README.md"))).toMatchObject({
      path: "README.md",
      sha: "blob-sha"
    });
    expect(mapGitHubContentToBlob(createContentModel("README.md"))).toMatchObject({
      encoding: "base64",
      path: "README.md"
    });
    expect(mapGitHubContentToTreeNode(createContentModel("src", "", "dir"))).toMatchObject({
      path: "src",
      type: "directory"
    });
    expect(mapGitHubIssue(createIssueModel(1))).toMatchObject({ number: 1, state: "open" });
    expect(mapGitHubPullRequest(createPullRequestModel(2), repository)).toMatchObject({
      number: 2,
      state: "open"
    });
    expect(mapGitHubRelease(createReleaseModel("v1.0.0"))).toMatchObject({
      state: "published",
      tagName: "v1.0.0"
    });
    expect(mapGitHubSearchItem({ path: "README.md", score: 1, type: "file" })).toMatchObject({
      kind: "file",
      score: 1
    });
  });
});

describe("public exports", () => {
  it("exports provider factory, config helper, client helper, classes, and public types", async () => {
    expect(createGitHubProvider()).toBeInstanceOf(GitHubProvider);
    expect(githubProvider()).toBeInstanceOf(GitHubProvider);
    expect(createGitHubProviderConfig().providers?.[0]?.info.id).toBe("github");
    expect(createGitHubClient()).toBeInstanceOf(GitBridgeClient);
    expectTypeOf<GitHubClientConfig>().toHaveProperty("token");
    expectTypeOf<GitHubProviderConfig>().toHaveProperty("transport");

    const authentication = githubTokenAuth("secret");
    await expect(
      authentication.authenticate({ provider: GitHubProviderId })
    ).resolves.toMatchObject({
      credentials: { kind: "access-token", provider: "github", token: "secret" },
      provider: "github",
      type: "token"
    });
    expect("Octokit" in publicApi).toBe(false);
    expect("createOctokitAdapter" in publicApi).toBe(false);
    expect("createTransportOctokitAdapter" in publicApi).toBe(false);
  });
});

function createCacheProvider() {
  return {
    clear: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined)
  };
}

function createDiagnostics() {
  return {
    publish: vi.fn(async () => undefined),
    subscribe: vi.fn(async () => async () => undefined)
  };
}

function createMockTransport(routes: Readonly<Record<string, unknown | Error>>): Transport {
  return {
    execute: vi.fn(
      async <TBody = unknown>(request: TransportRequest): Promise<TransportResponse<TBody>> => {
        const route = routes[request.target];

        if (route instanceof Error) {
          throw route;
        }

        if (route === undefined) {
          return { status: 404 };
        }

        if (isMockResponse(route)) {
          const response: TransportResponse<TBody> = {
            body: route.data as TBody,
            status: route.status ?? 200
          };

          if (route.headers !== undefined) {
            response.headers = route.headers;
          }

          return response;
        }

        return { body: route as TBody, status: 200 };
      }
    )
  };
}

function createDataResponseTransport(routes: Readonly<Record<string, unknown | Error>>): Transport {
  return {
    execute: vi.fn(async <TBody = unknown>(request: TransportRequest) => {
      const route = routes[request.target];

      if (route instanceof Error) {
        throw route;
      }

      if (route === undefined) {
        return { status: 404 };
      }

      return {
        data: route as TBody,
        status: 200
      };
    }) as Transport["execute"]
  };
}

function isMockResponse(value: unknown): value is Readonly<{
  data: unknown;
  headers?: Readonly<Record<string, string>>;
  status?: number;
}> {
  return value !== null && typeof value === "object" && "data" in value;
}

function createRepositoryModel(): GitHubRepositoryModel {
  return {
    archived: false,
    created_at: "2026-01-01T00:00:00.000Z",
    default_branch: "main",
    description: "Codex",
    fork: false,
    full_name: "openai/codex",
    html_url: "https://github.com/openai/codex",
    name: "codex",
    owner: {
      id: 1,
      login: "openai",
      type: "Organization"
    },
    private: false,
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "public"
  };
}

function createBranchModel(name: string): GitHubBranchModel {
  return {
    commit: { sha: "abc123", url: "https://api.github.com/repos/openai/codex/commits/abc123" },
    name,
    protected: true
  };
}

function createTagRefModel(name: string): GitHubRefModel {
  return {
    object: { sha: "tag-sha", type: "commit" },
    ref: `refs/tags/${name}`
  };
}

function createCommitModel(sha: string): GitHubCommitModel {
  return {
    author: { login: "ada" },
    commit: {
      author: {
        date: "2026-01-01T00:00:00.000Z",
        email: "ada@example.com",
        name: "Ada"
      },
      message: "Initial commit",
      tree: { sha: "tree-sha" },
      verification: { verified: true }
    },
    html_url: `https://github.com/openai/codex/commit/${sha}`,
    parents: [{ sha: "parent-sha" }],
    sha
  };
}

function createTreeModel(): GitHubTreeModel {
  return {
    sha: "tree-sha",
    tree: [
      {
        mode: "100644",
        path: "README.md",
        sha: "blob-sha",
        size: 7,
        type: "blob"
      }
    ],
    truncated: false
  };
}

function createContentModel(path: string, text = "# Hello", type = "file"): GitHubContentModel {
  return {
    content: Buffer.from(text, "utf8").toString("base64"),
    download_url: `https://raw.githubusercontent.com/openai/codex/main/${path}`,
    encoding: "base64",
    html_url: `https://github.com/openai/codex/blob/main/${path}`,
    name: path.split("/").pop() ?? path,
    path,
    sha: "blob-sha",
    size: text.length,
    type
  };
}

function createIssueModel(number: number): GitHubIssueModel {
  return {
    body: "Issue body",
    created_at: "2026-01-01T00:00:00.000Z",
    html_url: `https://github.com/openai/codex/issues/${number}`,
    id: number,
    labels: [{ name: "bug" }],
    number,
    state: "open",
    title: `Issue ${number}`,
    updated_at: "2026-01-02T00:00:00.000Z",
    user: { login: "ada" }
  };
}

function createPullRequestModel(number: number): GitHubPullRequestModel {
  return {
    base: {
      ref: "main",
      repo: createRepositoryModel(),
      sha: "base-sha"
    },
    body: "Pull request body",
    created_at: "2026-01-01T00:00:00.000Z",
    head: {
      ref: "feature",
      repo: createRepositoryModel(),
      sha: "head-sha"
    },
    html_url: `https://github.com/openai/codex/pull/${number}`,
    id: number,
    number,
    state: "open",
    title: `Pull request ${number}`,
    updated_at: "2026-01-02T00:00:00.000Z",
    user: { login: "ada" }
  };
}

function createReleaseModel(tagName: string): GitHubReleaseModel {
  return {
    assets: [
      {
        browser_download_url: "https://github.com/openai/codex/releases/download/v1.0.0/app.tgz",
        content_type: "application/gzip",
        name: "app.tgz",
        size: 10
      }
    ],
    author: { login: "ada" },
    body: "Release body",
    created_at: "2026-01-01T00:00:00.000Z",
    draft: false,
    html_url: `https://github.com/openai/codex/releases/tag/${tagName}`,
    id: 1,
    name: tagName,
    prerelease: false,
    published_at: "2026-01-02T00:00:00.000Z",
    tag_name: tagName
  };
}

function createSearchModel(): GitHubSearchResponseModel {
  return {
    incomplete_results: false,
    items: [
      {
        html_url: "https://github.com/openai/codex/blob/main/README.md",
        path: "README.md",
        score: 1,
        sha: "blob-sha",
        type: "file"
      }
    ],
    total_count: 1
  };
}
