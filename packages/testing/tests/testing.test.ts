import type { CapabilityMap } from "@gitbridge/contracts";
import { CapabilityNotSupportedError, ProviderError } from "@gitbridge/errors";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  assertBlob,
  assertBranch,
  assertCapabilityNotSupported,
  assertCommit,
  assertFileInfo,
  assertGitBridgeError,
  assertIssue,
  assertPagedResult,
  assertProviderInfo,
  assertProviderSession,
  assertPullRequest,
  assertRelease,
  assertRepositoryInfo,
  assertTag,
  assertTree,
  assertTreeNode,
  createCapabilityTestMatrix,
  createFakeProvider,
  createFakeProviderSession,
  createProviderCertification,
  fixtures,
  runProviderContractSuite,
  type CapabilityTestMatrix,
  type ProviderCertification
} from "../src/index.js";
import * as publicApi from "../src/index.js";

describe("provider certification model", () => {
  it("creates passed and failed certification results", () => {
    expect(createProviderCertification("fake")).toEqual({
      checks: [],
      provider: "fake",
      status: "passed"
    });
    expect(
      createProviderCertification("fake", [{ name: "metadata", status: "failed" }])
    ).toMatchObject({ status: "failed" });
  });

  it("builds the default capability matrix with required foundation capabilities", () => {
    const matrix = createCapabilityTestMatrix();

    expect(matrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: "files", requirement: "required" }),
        expect.objectContaining({ capability: "tree", requirement: "required" }),
        expect.objectContaining({ capability: "history", requirement: "required" }),
        expect.objectContaining({ capability: "search", requirement: "required" }),
        expect.objectContaining({ capability: "issues", requirement: "optional" })
      ])
    );
    expect(Object.isFrozen(matrix)).toBe(true);
  });
});

describe("provider contract runner", () => {
  it("certifies a fake provider with behavior checks", async () => {
    const provider = createFakeProvider();
    const result = await runProviderContractSuite({
      capabilities: createCapabilityTestMatrix([
        {
          capability: "files",
          requirement: "required",
          run: async (session) => {
            await expect(session.capabilities.files.readText("README.md")).resolves.toBe("fixture");
          }
        },
        {
          capability: "issues",
          requirement: "optional",
          run: async (session) => {
            await expect(session.capabilities.issues?.get(1)).resolves.toMatchObject({
              number: 1
            });
          }
        }
      ]),
      provider,
      repository: { url: "https://example.com/acme/project" }
    });

    expect(result.status).toBe("passed");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "provider metadata", status: "passed" }),
        expect.objectContaining({ name: "files capability behavior", status: "passed" }),
        expect.objectContaining({ name: "issues capability behavior", status: "passed" })
      ])
    );
  });

  it("fails required capabilities that are missing or unsupported", async () => {
    const capabilities: CapabilityMap = {
      files: { name: "files", status: "unsupported" },
      history: { name: "history", status: "supported" },
      search: { name: "search", status: "supported" },
      tree: { name: "tree", status: "supported" }
    };
    const provider = createFakeProvider({ info: { capabilities } });
    const result = await runProviderContractSuite({
      provider,
      repository: { url: "https://example.com/acme/project" }
    });

    expect(result.status).toBe("failed");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "files",
          message: "Required capability is not supported",
          status: "failed"
        })
      ])
    );
  });

  it("classifies unsupported optional capabilities and verifies unsupported behavior", async () => {
    const capabilities: CapabilityMap = {
      files: { name: "files", status: "supported" },
      history: { name: "history", status: "supported" },
      issues: { name: "issues", status: "unsupported" },
      search: { name: "search", status: "supported" },
      tree: { name: "tree", status: "supported" }
    };
    const provider = createFakeProvider({ info: { capabilities } });
    const result = await runProviderContractSuite({
      provider,
      repository: { url: "https://example.com/acme/project" },
      unsupportedOptional: {
        issues: async () => {
          throw new CapabilityNotSupportedError("Issues are not supported");
        }
      }
    });

    expect(result.status).toBe("passed");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: "issues", status: "unsupported-capability" }),
        expect.objectContaining({ capability: "issues", status: "passed" })
      ])
    );
  });
});

describe("fake provider utilities and assertions", () => {
  it("creates reusable fake sessions and validates provider-neutral fixtures", async () => {
    const session = createFakeProviderSession();

    assertProviderInfo(session.provider);
    assertProviderSession(session);
    assertRepositoryInfo(fixtures.repositoryInfo);
    assertBranch(fixtures.branch);
    assertTag(fixtures.tag);
    assertCommit(fixtures.commit);
    assertTreeNode(fixtures.treeNode);
    assertTree(fixtures.tree);
    assertBlob(fixtures.blob);
    assertFileInfo(fixtures.fileInfo);
    assertIssue(fixtures.issue);
    assertPullRequest(fixtures.pullRequest);
    assertRelease(fixtures.release);
    assertPagedResult({ items: [fixtures.fileInfo], pageInfo: {} });

    await session.dispose();
    await expect(session.getCapabilities()).rejects.toThrow(ProviderError);
  });

  it("asserts GitBridge error families", () => {
    const error = new CapabilityNotSupportedError("Nope");

    expect(() => assertGitBridgeError(error)).not.toThrow();
    expect(() => assertCapabilityNotSupported(error)).not.toThrow();
    expect(() => assertGitBridgeError(new Error("plain"))).toThrow("Expected a GitBridgeError");
  });
});

describe("public exports", () => {
  it("exports the contract kit APIs and public types", () => {
    expect(publicApi.runProviderContractSuite).toBe(runProviderContractSuite);
    expect(publicApi.createFakeProvider()).toBeDefined();
    expectTypeOf<CapabilityTestMatrix>().toMatchTypeOf<readonly unknown[]>();
    expectTypeOf<ProviderCertification>().toHaveProperty("checks");
  });
});
