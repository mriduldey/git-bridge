import type { Provider, ProviderSession, RepositoryInfo } from "@gitbridge/contracts";
import {
  CapabilityNotSupportedError,
  ConfigurationError,
  ConflictError,
  NotFoundError,
  RepositoryError,
  ValidationError
} from "@gitbridge/errors";
import { createDiagnosticsService } from "@gitbridge/observability";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  GitBridgeClient,
  Repository,
  RepositoryFactory,
  RepositoryRef,
  createGitBridgeClient,
  createRepository,
  createRepositoryRef,
  resolveConfiguration,
  resolveGitBridgeConfig,
  type CapabilityRegistryView,
  type GitBridgeClientConfig,
  type GitBridgeRuntimeContext,
  type ProviderRegistryView
} from "../src/index.js";

describe("GitBridge client foundation", () => {
  it("creates an isolated client with resolved default dependencies", () => {
    const client = new GitBridgeClient();

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
    const first = createGitBridgeClient();
    const second = createGitBridgeClient();

    expect(first).toBeInstanceOf(GitBridgeClient);
    expect(second).toBeInstanceOf(GitBridgeClient);
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
    const transport = {
      execute: vi.fn(async () => ({ status: 204 }))
    };
    const client = new GitBridgeClient({
      cache,
      diagnostics,
      metadata: { provider: "test" },
      transport
    });

    expect(client.config.cache).toBe(cache);
    expect(client.config.diagnostics).toBe(diagnostics);
    expect(client.config.transport).toBe(transport);
    expect(client.context.metadata).toEqual({ provider: "test" });

    await client.dispose();

    expect(cache.dispose).not.toHaveBeenCalled();
    expect(client.state).toBe("disposed");
  });

  it("disposes owned dependencies idempotently and rejects active checks after disposal", async () => {
    const client = new GitBridgeClient();

    await client.dispose();
    await client.dispose();

    expect(client.state).toBe("disposed");
    expect(() => client.ensureActive()).toThrow(ConfigurationError);
  });
});

describe("provider registration", () => {
  it("registers providers deterministically by priority and id", () => {
    const client = new GitBridgeClient({
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
    expect(() => new GitBridgeClient({ providers: [createProvider(" ")] })).toThrow(
      ValidationError
    );
    expect(
      () => new GitBridgeClient({ providers: [createProvider("github"), createProvider("github")] })
    ).toThrow(ConflictError);

    const client = new GitBridgeClient();

    expect(() => client.providers.require("missing")).toThrow(NotFoundError);
  });
});

describe("capability registration", () => {
  it("registers configured capabilities and provider-advertised capabilities", () => {
    const client = new GitBridgeClient({
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
      () => new GitBridgeClient({ capabilities: [{ name: " ", status: "supported" }] })
    ).toThrow(ValidationError);
    expect(
      () =>
        new GitBridgeClient({
          capabilities: [
            { name: "files", status: "supported" },
            { name: "files", status: "partial" }
          ]
        })
    ).toThrow(ConflictError);

    const client = new GitBridgeClient();

    expect(() => client.capabilities.require("files")).toThrow(NotFoundError);
  });
});

describe("public exports", () => {
  it("exports foundation and repository model contracts without client open orchestration", () => {
    expectTypeOf<GitBridgeClientConfig>().toHaveProperty("providers");
    expectTypeOf<GitBridgeRuntimeContext>().toHaveProperty("providers");
    expectTypeOf<ProviderRegistryView>().toHaveProperty("ids");
    expectTypeOf<CapabilityRegistryView>().toHaveProperty("names");
    expectTypeOf<Repository>().toHaveProperty("ref");
    expectTypeOf<RepositoryRef>().toHaveProperty("readme");

    const client = new GitBridgeClient();
    const repository = createRepository({ info: createRepositoryInfo() });

    expect("open" in client).toBe(false);
    expect(repository).toBeInstanceOf(Repository);
    expect(
      createRepositoryRef({ capabilities: {}, reference: "main", repository: repository.identity })
    ).toBeInstanceOf(RepositoryRef);
    expect(resolveGitBridgeConfig()).toMatchObject({
      capabilities: [],
      providers: []
    });
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

  it("exposes capability services and defers execution through GitBridge errors", async () => {
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
