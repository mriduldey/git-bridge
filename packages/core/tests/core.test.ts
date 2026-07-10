import type {
  AuthenticationStrategy,
  CreateSessionRequest,
  DiagnosticEvent,
  FilesCapability,
  PagedResult,
  Provider,
  ProviderMatch,
  ProviderSession,
  RepositoryInfo,
  RepositoryLocator,
  SearchResult
} from "@sourceaxis/contracts";
import {
  CapabilityNotSupportedError,
  ConfigurationError,
  ConflictError,
  NotFoundError,
  RepositoryError,
  ValidationError
} from "@sourceaxis/errors";
import { createDiagnosticsService } from "@sourceaxis/observability";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  SourceAxisClient,
  Repository,
  RepositoryFactory,
  RepositoryRef,
  createSourceAxisClient,
  createRepository,
  createRepositoryRef,
  resolveConfiguration,
  resolveSourceAxisConfig,
  type CapabilityRegistryView,
  type SourceAxisClientConfig,
  type SourceAxisRuntimeContext,
  type ProviderRegistryView
} from "../src/index.js";

describe("SourceAxis client foundation", () => {
  it("creates an isolated client with resolved default dependencies", () => {
    const client = new SourceAxisClient();

    expect(client.state).toBe("active");
    expect(client.config.transport).toMatchObject({ execute: expect.any(Function) });
    expect(client.config.cache).toMatchObject({ register: expect.any(Function) });
    expect(client.config.diagnostics).toMatchObject({ publish: expect.any(Function) });
    expect(client.config.metrics).toMatchObject({ counter: expect.any(Function) });
    expect(client.config.tracer).toMatchObject({ startSpan: expect.any(Function) });
    expect(client.providers.ids()).toEqual([]);
    expect(client.capabilities.names()).toEqual([]);
    expect(Object.isFrozen(client.config)).toBe(true);
    expect(Object.isFrozen(client.context)).toBe(true);
  });

  it("supports factory bootstrap without global mutable configuration", () => {
    const first = createSourceAxisClient();
    const second = createSourceAxisClient();

    expect(first).toBeInstanceOf(SourceAxisClient);
    expect(second).toBeInstanceOf(SourceAxisClient);
    expect(first.config.cache).not.toBe(second.config.cache);
  });

  it("resolves configuration using defaults, client, repository, then operation precedence", () => {
    const resolved = resolveConfiguration<{
      readonly timeoutMs?: number;
      readonly provider?: string;
    }>({
      client: { provider: "github", timeoutMs: 1000 },
      defaults: { provider: "default", timeoutMs: 500 },
      operation: { timeoutMs: 3000 },
      repository: { provider: "gitlab" }
    });

    expect(resolved).toEqual({ provider: "gitlab", timeoutMs: 3000 });
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it("uses injected dependencies without taking ownership of external cache disposal", async () => {
    const cache = {
      clear: vi.fn(),
      delete: vi.fn(),
      dispose: vi.fn(),
      get: vi.fn(),
      has: vi.fn(),
      names: vi.fn(),
      register: vi.fn(),
      require: vi.fn()
    };
    const diagnostics = createDiagnosticsService();
    const authentication: AuthenticationStrategy = {
      type: "anonymous",
      authenticate: vi.fn(async () => ({
        credentials: { kind: "anonymous" as const },
        type: "anonymous" as const
      }))
    };
    const transport = {
      execute: vi.fn(async () => ({ status: 204 }))
    };
    const client = new SourceAxisClient({
      authentication,
      cache,
      diagnostics,
      metadata: { provider: "test" },
      transport
    });

    expect(client.config.cache).toBe(cache);
    expect(client.context.authentication).toBe(authentication);
    expect(client.config.diagnostics).toBe(diagnostics);
    expect(client.config.transport).toBe(transport);
    expect(client.context.metadata).toEqual({ provider: "test" });

    await client.dispose();

    expect(cache.dispose).not.toHaveBeenCalled();
    expect(client.state).toBe("disposed");
  });

  it("disposes owned dependencies idempotently and rejects active checks after disposal", async () => {
    const client = new SourceAxisClient();

    await client.dispose();
    await client.dispose();

    expect(client.state).toBe("disposed");
    expect(() => client.ensureActive()).toThrow(ConfigurationError);
  });
});

describe("provider registration", () => {
  it("registers providers deterministically by priority and id", () => {
    const client = new SourceAxisClient({
      providers: [
        createProvider("gitlab", 10),
        createProvider("github", 1),
        createProvider("gitea", 1)
      ]
    });

    expect(client.providers.ids()).toEqual(["gitea", "github", "gitlab"]);
    expect(client.providers.has("github")).toBe(true);
    expect(client.providers.get("github")?.info.name).toBe("github provider");
    expect(client.providers.require("gitlab").info.id).toBe("gitlab");
    expect(client.config.providers.map((provider) => provider.info.id)).toEqual([
      "gitea",
      "github",
      "gitlab"
    ]);
  });

  it("rejects invalid, duplicate, and missing providers through approved errors", () => {
    expect(() => new SourceAxisClient({ providers: [createProvider(" ")] })).toThrow(
      ValidationError
    );
    expect(
      () =>
        new SourceAxisClient({ providers: [createProvider("github"), createProvider("github")] })
    ).toThrow(ConflictError);

    const client = new SourceAxisClient();

    expect(() => client.providers.require("missing")).toThrow(NotFoundError);
  });
});

describe("capability registration", () => {
  it("registers configured capabilities and provider-advertised capabilities", () => {
    const client = new SourceAxisClient({
      capabilities: [{ name: "metadata", status: "supported" }],
      providers: [
        createProvider("github", 0, {
          files: { name: "files", operations: ["readText"], status: "supported" },
          tree: { name: "tree", status: "partial" }
        })
      ]
    });

    expect(client.capabilities.names()).toEqual(["metadata", "files", "tree"]);
    expect(client.capabilities.has("files")).toBe(true);
    expect(client.capabilities.get("tree")).toEqual({ name: "tree", status: "partial" });
    expect(client.capabilities.require("metadata").status).toBe("supported");
    expect(client.config.capabilities.map((capability) => capability.name)).toEqual([
      "metadata",
      "files",
      "tree"
    ]);
  });

  it("rejects invalid, duplicate, and missing capabilities through approved errors", () => {
    expect(
      () => new SourceAxisClient({ capabilities: [{ name: " ", status: "supported" }] })
    ).toThrow(ValidationError);
    expect(
      () =>
        new SourceAxisClient({
          capabilities: [
            { name: "files", status: "supported" },
            { name: "files", status: "partial" }
          ]
        })
    ).toThrow(ConflictError);

    const client = new SourceAxisClient();

    expect(() => client.capabilities.require("files")).toThrow(NotFoundError);
  });
});

describe("public exports", () => {
  it("exports foundation, repository model, and client orchestration contracts", () => {
    expectTypeOf<SourceAxisClientConfig>().toHaveProperty("providers");
    expectTypeOf<SourceAxisRuntimeContext>().toHaveProperty("providers");
    expectTypeOf<ProviderRegistryView>().toHaveProperty("ids");
    expectTypeOf<CapabilityRegistryView>().toHaveProperty("names");
    expectTypeOf<Repository>().toHaveProperty("ref");
    expectTypeOf<Repository>().toHaveProperty("defaultRef");
    expectTypeOf<Repository>().toHaveProperty("readText");
    expectTypeOf<RepositoryRef>().toHaveProperty("readme");
    expectTypeOf<RepositoryRef>().toHaveProperty("commits");

    const client = new SourceAxisClient();
    const repository = createRepository({ info: createRepositoryInfo() });

    expect("open" in client).toBe(true);
    expect(repository).toBeInstanceOf(Repository);
    expect(
      createRepositoryRef({ capabilities: {}, reference: "main", repository: repository.identity })
    ).toBeInstanceOf(RepositoryRef);
    expect(resolveSourceAxisConfig()).toMatchObject({
      capabilities: [],
      providers: []
    });
  });
});

describe("core orchestration", () => {
  it("opens repositories by resolving a provider and creating a provider session", async () => {
    const provider = createMatchingProvider("github");
    const client = new SourceAxisClient({ providers: [provider] });

    const repository = await client.open("https://github.example.com/owner/repo", {
      correlationId: "corr-1",
      timeoutMs: 1000
    });

    expect(repository).toBeInstanceOf(Repository);
    expect(repository.identity).toEqual({ name: "repo", owner: "owner", provider: "github" });
    expect(repository.capabilities.files).toEqual({ name: "files", status: "supported" });
    expect(provider.supports).toHaveBeenCalledWith({
      url: "https://github.example.com/owner/repo"
    });
    expect(provider.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "corr-1",
        repository: { name: "repo", owner: "owner", provider: "github" },
        timeoutMs: 1000
      })
    );
    await expect(repository.ref("main").readme()).resolves.toBe("read:README.md");
  });

  it("creates provider context with authentication and merged metadata", async () => {
    const provider = createMatchingProvider("github", {
      matchMetadata: { extra: { match: true }, requestId: "match-1" }
    });
    const authentication: AuthenticationStrategy = {
      type: "anonymous",
      authenticate: vi.fn(async () => ({
        credentials: { kind: "anonymous" as const, provider: "github" },
        provider: "github",
        type: "anonymous" as const
      }))
    };
    const client = new SourceAxisClient({
      authentication,
      metadata: { extra: { client: true }, provider: "client" },
      providers: [provider]
    });

    await client.open("https://github.example.com/owner/repo");

    const request = provider.createSession.mock.calls[0]?.[0] as CreateSessionRequest;

    expect(authentication.authenticate).toHaveBeenCalledWith({ provider: "github" });
    expect(request.context.authentication).toBe(authentication);
    expect(request.context.authenticationContext).toMatchObject({
      provider: "github",
      type: "anonymous"
    });
    expect(request.context.metadata).toEqual({
      extra: { client: true, match: true },
      provider: "client",
      requestId: "match-1"
    });
  });

  it("rejects provider not found and multiple provider matches", async () => {
    await expect(
      new SourceAxisClient().open("https://unknown.example.com/owner/repo")
    ).rejects.toThrow(NotFoundError);

    await expect(
      new SourceAxisClient({
        providers: [createMatchingProvider("one"), createMatchingProvider("two")]
      }).open("https://example.com/owner/repo")
    ).rejects.toThrow(ConfigurationError);
  });

  it("translates provider support and session failures through SourceAxis errors", async () => {
    const supportFailure = createMatchingProvider("github");
    supportFailure.supports.mockRejectedValueOnce(new Error("boom"));

    await expect(
      new SourceAxisClient({ providers: [supportFailure] }).open("https://example.com/owner/repo")
    ).rejects.toThrow(RepositoryError);

    const sessionFailure = createMatchingProvider("github");
    sessionFailure.createSession.mockRejectedValueOnce(new Error("boom"));

    await expect(
      new SourceAxisClient({ providers: [sessionFailure] }).open("https://example.com/owner/repo")
    ).rejects.toThrow(RepositoryError);
  });

  it("coordinates repository and session disposal", async () => {
    const provider = createMatchingProvider("github");
    const client = new SourceAxisClient({ providers: [provider] });
    const repository = await client.open("https://github.example.com/owner/repo");
    const session = provider.lastSession;

    await repository.dispose();
    await repository.dispose();

    expect(session.dispose).toHaveBeenCalledTimes(1);

    const second = await client.open("https://github.example.com/owner/repo");
    const secondSession = provider.lastSession;

    await client.dispose();

    expect(second.state).toBe("disposed");
    expect(secondSession.dispose).toHaveBeenCalledTimes(1);
    await expect(client.open("https://github.example.com/owner/repo")).rejects.toThrow(
      ConfigurationError
    );
  });

  it("disposes a created provider session when repository creation fails", async () => {
    const dispose = vi.fn(async () => undefined);
    const provider = createMatchingProvider("github");

    provider.createSession.mockResolvedValueOnce({
      capabilities: createSessionCapabilities(),
      provider: provider.info,
      repository: createRepositoryInfo("github"),
      state: "active",
      dispose,
      getCapabilities: vi.fn(async () => {
        throw new Error("capability failure");
      })
    });

    await expect(
      new SourceAxisClient({ providers: [provider] }).open("https://github.example.com/owner/repo")
    ).rejects.toThrow("capability failure");
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("publishes core lifecycle diagnostics without allowing subscribers to change behavior", async () => {
    const diagnostics = createDiagnosticsService();
    const events: DiagnosticEvent[] = [];
    await diagnostics.subscribe((event) => {
      events.push(event);
      if (event.name === "repository.open.start") {
        throw new Error("observer failure");
      }
    });
    const client = new SourceAxisClient({
      diagnostics,
      providers: [createMatchingProvider("github")]
    });

    await expect(
      client.open("https://github.example.com/owner/repo", { correlationId: "corr-1" })
    ).resolves.toBeInstanceOf(Repository);
    await client.dispose();

    expect(events.map((event) => event.name)).toEqual([
      "repository.open.start",
      "repository.open.success",
      "client.dispose.start",
      "client.dispose.success"
    ]);
    expect(events[0]?.context?.correlationId).toBe("corr-1");
    expect(events[1]?.data).toMatchObject({
      provider: "github",
      repository: "owner/repo"
    });
  });

  it("supports RepositoryFactory integration from provider sessions", async () => {
    const provider = createMatchingProvider("github");
    const session = await provider.createSession({
      context: { provider: provider.info },
      repository: { url: "https://github.example.com/owner/repo" }
    });
    const repository = await new RepositoryFactory().createFromSession(session);

    expect(repository.identity.provider).toBe("github");
    expect(repository.capabilities.tree).toEqual({ name: "tree", status: "supported" });
    await expect(repository.ref("main").files.readText("README.md")).resolves.toBe(
      "read:README.md"
    );
  });
});

describe("Repository model", () => {
  it("constructs immutable repository state from provider-neutral repository info", () => {
    const repository = new Repository({
      capabilities: {
        files: { name: "files", operations: ["readText"], status: "supported" },
        tree: { name: "tree", status: "partial" }
      },
      extensions: { custom: { enabled: true } },
      info: createRepositoryInfo()
    });

    expect(repository.identity).toEqual({ name: "repo", owner: "owner", provider: "github" });
    expect(repository.info.fullName).toBe("owner/repo");
    expect(repository.capabilities.files?.status).toBe("supported");
    expect(repository.extensions).toEqual({ custom: { enabled: true } });
    expect(repository.state).toBe("active");
    expect(Object.isFrozen(repository.info)).toBe(true);
    expect(Object.isFrozen(repository.capabilities)).toBe(true);
    expect(Object.isFrozen(repository.extensions)).toBe(true);
  });

  it("uses RepositoryFactory and createRepository as construction helpers", () => {
    const factory = new RepositoryFactory();
    const fromFactory = factory.create({ info: createRepositoryInfo("gitlab") });
    const fromFunction = createRepository({ info: createRepositoryInfo("gitea") });

    expect(fromFactory.identity.provider).toBe("gitlab");
    expect(fromFunction.identity.provider).toBe("gitea");
  });

  it("disposes idempotently and rejects new refs after disposal", async () => {
    const repository = new Repository({ info: createRepositoryInfo() });

    await repository.dispose();
    await repository.dispose();

    expect(repository.state).toBe("disposed");
    expect(() => repository.ref("main")).toThrow(RepositoryError);
  });

  it("validates repository identity, capabilities, and extensions", () => {
    expect(
      () =>
        new Repository({
          info: createRepositoryInfo("github", {
            identity: { name: " ", owner: "owner", provider: "github" },
            name: " "
          })
        })
    ).toThrow(ValidationError);

    expect(
      () =>
        new Repository({
          capabilities: { files: { name: "contents", status: "supported" } },
          info: createRepositoryInfo()
        })
    ).toThrow(ValidationError);

    expect(
      () =>
        new Repository({
          extensions: { ref: {} },
          info: createRepositoryInfo()
        })
    ).toThrow(ValidationError);
  });
});

describe("RepositoryRef model", () => {
  it("creates immutable refs from reference names without provider execution", () => {
    const repository = new Repository({ info: createRepositoryInfo() });
    const reference = repository.ref("main");

    expect(reference).toBeInstanceOf(RepositoryRef);
    expect(reference.repository).toEqual(repository.identity);
    expect(reference.reference).toEqual({
      name: "main",
      repository: repository.identity,
      target: "main",
      type: "branch"
    });
    expect(Object.isFrozen(reference)).toBe(true);
    expect(Object.isFrozen(reference.reference)).toBe(true);
  });

  it("preserves explicit references when identity matches", () => {
    const repository = new Repository({ info: createRepositoryInfo() });
    const reference = repository.ref({
      name: "v1.0.0",
      repository: repository.identity,
      target: "abc123",
      type: "tag"
    });

    expect(reference.reference.type).toBe("tag");
    expect(reference.reference.target).toBe("abc123");
  });

  it("validates reference values and identity consistency", () => {
    const repository = new Repository({ info: createRepositoryInfo() });

    expect(() => repository.ref(" ")).toThrow(ValidationError);
    expect(() =>
      repository.ref({
        name: "main",
        repository: { name: "other", owner: "owner", provider: "github" },
        target: "abc123",
        type: "branch"
      })
    ).toThrow(ValidationError);
  });

  it("exposes capability services and defers execution through SourceAxis errors", async () => {
    const repository = new Repository({
      capabilities: {
        files: { name: "files", operations: ["readText"], status: "supported" }
      },
      info: createRepositoryInfo()
    });
    const reference = repository.ref("main");

    await expect(reference.files.readText("README.md")).rejects.toThrow(
      CapabilityNotSupportedError
    );
    await expect(reference.readme()).rejects.toThrow(CapabilityNotSupportedError);
    expect(() => reference.files.readText(" ")).toThrow(ValidationError);
  });

  it("routes readme through injected file services without transport execution", async () => {
    const repository = new Repository({
      info: createRepositoryInfo(),
      services: {
        files: {
          download: async () => ({ encoding: "utf-8", path: "README.md", sha: "sha", size: 1 }),
          exists: async () => true,
          getMetadata: async () => ({ name: "README.md", path: "README.md" }),
          metadata: async () => ({ name: "README.md", path: "README.md" }),
          readBinary: async () => new Uint8Array(),
          readJson: async <TValue>() => ({ ok: true }) as TValue,
          readText: async (path) => `read:${path}`,
          stream: async () => emptyByteStream()
        }
      }
    });

    await expect(repository.ref("main").readme()).resolves.toBe("read:README.md");
  });

  it("routes repository convenience methods through the default reference", async () => {
    class ObservedRepository extends Repository {
      public readonly references: string[] = [];

      public override ref(reference: Parameters<Repository["ref"]>[0]): RepositoryRef {
        if (typeof reference === "string") {
          this.references.push(reference);
        }

        return super.ref(reference);
      }
    }

    const repository = new ObservedRepository({
      defaultReference: "develop",
      info: createRepositoryInfo("github", { defaultBranch: "trunk" }),
      services: {
        files: {
          download: async (path) => ({ encoding: "utf-8", path, sha: "sha", size: 1 }),
          exists: async (path) => path === "README.md",
          getMetadata: async (path) => ({ name: path, path }),
          metadata: async (path) => ({ name: path, path }),
          readBinary: async () => new Uint8Array(),
          readJson: async <TValue>() => ({ ok: true }) as TValue,
          readText: async (path) => `read:${path}`,
          stream: async () => emptyByteStream()
        }
      }
    });

    expect(repository.defaultRef().reference.name).toBe("develop");
    await expect(repository.readText("README.md")).resolves.toBe("read:README.md");
    await expect(repository.readJson("package.json")).resolves.toEqual({ ok: true });
    await expect(repository.exists("README.md")).resolves.toBe(true);
    expect(repository.references).toEqual(["develop", "develop", "develop", "develop"]);
  });

  it("falls back from configured default reference to repository info and then main", () => {
    const withDefaultBranch = new Repository({
      info: createRepositoryInfo("github", { defaultBranch: "trunk" })
    });
    const withoutDefaultBranch = new Repository({ info: createRepositoryInfo() });

    expect(withDefaultBranch.defaultRef().reference.name).toBe("trunk");
    expect(withoutDefaultBranch.defaultRef().reference.name).toBe("main");
  });
});

function createProvider(
  id: string,
  priority?: number,
  capabilities: Provider["info"]["capabilities"] = {}
): Provider {
  const info: Provider["info"] =
    priority === undefined
      ? { capabilities, id, name: `${id} provider` }
      : { capabilities, id, name: `${id} provider`, priority };
  const session: ProviderSession = {
    capabilities: {} as ProviderSession["capabilities"],
    provider: info,
    repository: {
      fullName: "owner/repo",
      identity: { name: "repo", owner: "owner", provider: id },
      name: "repo",
      owner: { username: "owner" },
      url: `https://${id}.example.com/owner/repo`,
      visibility: "public"
    },
    state: "active",
    async dispose() {
      return undefined;
    },
    async getCapabilities() {
      return Object.values(capabilities).filter(
        (capability): capability is NonNullable<typeof capability> => capability !== undefined
      );
    }
  };

  return {
    info,
    async createSession() {
      return session;
    },
    async supports() {
      return { confidence: "none", provider: id };
    }
  };
}

function createMatchingProvider(
  id: string,
  options: Readonly<{ matchMetadata?: CreateSessionRequest["context"]["metadata"] }> = {}
) {
  let lastSession = createProviderSession(id);
  const info: Provider["info"] = {
    capabilities: {
      files: { name: "files", status: "supported" },
      tree: { name: "tree", status: "supported" }
    },
    id,
    name: `${id} provider`
  };
  const supports = vi.fn(async (_locator: RepositoryLocator): Promise<ProviderMatch> => {
    const match: {
      confidence: "exact";
      metadata?: NonNullable<CreateSessionRequest["context"]["metadata"]>;
      provider: string;
      repository: { name: string; owner: string; provider: string };
    } = {
      confidence: "exact",
      provider: id,
      repository: { name: "repo", owner: "owner", provider: id }
    };

    if (options.matchMetadata !== undefined) {
      match.metadata = options.matchMetadata;
    }

    return match;
  });
  const createSession = vi.fn(async (_request: CreateSessionRequest) => {
    lastSession = createProviderSession(id);
    return lastSession;
  });

  return {
    get lastSession() {
      return lastSession;
    },
    createSession,
    info,
    supports
  };
}

function createProviderSession(id: string): ProviderSession {
  const capabilities = createSessionCapabilities();
  const provider: Provider["info"] = {
    capabilities: {
      files: { name: "files", status: "supported" },
      tree: { name: "tree", status: "supported" }
    },
    id,
    name: `${id} provider`
  };

  return {
    capabilities,
    provider,
    repository: createRepositoryInfo(id),
    state: "active",
    dispose: vi.fn(async () => undefined),
    async getCapabilities() {
      return [
        { name: "files", status: "supported" },
        { name: "tree", status: "supported" }
      ];
    }
  };
}

function createSessionCapabilities(): ProviderSession["capabilities"] {
  const files: FilesCapability = {
    download: async (path) => ({ encoding: "utf-8", path, sha: "sha", size: 1 }),
    exists: async () => true,
    metadata: async (path) => ({ name: path, path }),
    getMetadata: async (path) => ({ name: path, path }),
    readBinary: async () => new Uint8Array(),
    readJson: async <TValue>() => ({ ok: true }) as TValue,
    readText: async (path) => `read:${path}`,
    stream: async () => emptyByteStream()
  };

  return {
    files,
    history: {
      file: async () => emptyPage(),
      get: async (sha) => ({
        author: { name: "author" },
        message: "message",
        parents: [],
        sha,
        tree: "tree"
      }),
      list: async () => emptyPage()
    },
    search: {
      query: async <TItem>() => emptySearchPage<TItem>(),
      text: async () => emptyPage<SearchResult>()
    },
    tree: {
      get: async (path) => ({ name: path, path, type: "file" }),
      list: async () => [],
      tree: async (path = "") => ({ nodes: [], path, sha: "tree" }),
      walk: () => emptyTreeNodeStream()
    }
  };
}

function emptyPage<T>(): PagedResult<T> {
  return {
    items: [],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false
    }
  };
}

function emptySearchPage<TItem>(): PagedResult<SearchResult<TItem>> {
  return {
    items: [],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false
    }
  };
}

async function* emptyTreeNodeStream(): AsyncIterable<never> {
  return undefined;
}

async function* emptyByteStream(): AsyncIterable<Uint8Array> {
  return undefined;
}

function createRepositoryInfo(
  provider = "github",
  overrides: Partial<RepositoryInfo> = {}
): RepositoryInfo {
  const identity = overrides.identity ?? { name: "repo", owner: "owner", provider };

  return {
    fullName: `${identity.owner}/${identity.name}`,
    identity,
    name: identity.name,
    owner: { username: identity.owner },
    url: `https://${provider}.example.com/${identity.owner}/${identity.name}`,
    visibility: "public",
    ...overrides
  };
}
