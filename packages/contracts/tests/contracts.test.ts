import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AuthenticationStrategy,
  Blob,
  Branch,
  CapabilityMap,
  Commit,
  FilesCapability,
  GitActor,
  Issue,
  PagedResult,
  Provider,
  PullRequest,
  Release,
  Repository,
  RepositoryInfo,
  RepositoryRef,
  SearchResult,
  Tag,
  TreeNode,
  User
} from "../src/index.js";

describe("contracts runtime surface", () => {
  it("does not expose runtime implementation values", async () => {
    const contracts = await import("../src/index.js");

    expect(Object.keys(contracts)).toEqual([]);
  });
});

describe("public contract types", () => {
  it("models immutable domain values", () => {
    type ReadonlyUser = Readonly<{
      id?: string;
      username: string;
      displayName?: string;
      email?: string;
      avatarUrl?: string;
      url?: string;
      metadata?: unknown;
    }>;

    expectTypeOf<User>().toMatchTypeOf<ReadonlyUser>();
    expectTypeOf<GitActor>().toMatchTypeOf<Readonly<{ name: string; email?: string }>>();
    expectTypeOf<Commit>()
      .toHaveProperty("parents")
      .toEqualTypeOf<readonly Readonly<{ sha: string; url?: string }>[]>();
    expectTypeOf<Branch>().toMatchTypeOf<Readonly<{ type: "branch"; name: string }>>();
    expectTypeOf<Tag>().toMatchTypeOf<Readonly<{ type: "tag"; name: string }>>();
    expectTypeOf<Blob>().toMatchTypeOf<Readonly<{ path: string; size: number }>>();
    expectTypeOf<TreeNode>().toMatchTypeOf<Readonly<{ path: string; name: string }>>();
    expectTypeOf<Release>().toMatchTypeOf<Readonly<{ tagName: string }>>();
    expectTypeOf<Issue>().toMatchTypeOf<Readonly<{ number: number; title: string }>>();
    expectTypeOf<PullRequest>().toMatchTypeOf<Readonly<{ number: number; title: string }>>();
  });

  it("models provider-neutral service and capability contracts", () => {
    expectTypeOf<Repository>()
      .toHaveProperty("ref")
      .parameter(0)
      .toEqualTypeOf<string | import("../src/index.js").Reference>();
    expectTypeOf<RepositoryRef>().toHaveProperty("files").toMatchTypeOf<FilesCapability>();
    expectTypeOf<FilesCapability>()
      .toHaveProperty("readText")
      .returns.toEqualTypeOf<Promise<string>>();
    expectTypeOf<FilesCapability>()
      .toHaveProperty("readJson")
      .returns.toEqualTypeOf<Promise<import("../src/index.js").JsonValue>>();
    expectTypeOf<PagedResult<SearchResult<RepositoryInfo>>>()
      .toHaveProperty("items")
      .toEqualTypeOf<readonly SearchResult<RepositoryInfo>[]>();
    expectTypeOf<CapabilityMap>().toHaveProperty("files");
    expectTypeOf<Provider>().toHaveProperty("createSession");
    expectTypeOf<AuthenticationStrategy>().toHaveProperty("authenticate");
  });
});
