import { describe, expect, it } from "vitest";

import {
  createCapabilityTestMatrix,
  runProviderContractSuite,
  type CapabilityTestMatrix
} from "../src/index.js";
import type { Transport, TransportRequest, TransportResponse } from "@gitbridge/contracts";
import { createGitHubProvider } from "@gitbridge/provider-github";

describe("GitHub provider certification smoke test", () => {
  it("runs the GitHub provider through the reusable contract suite with mocked SDK calls", async () => {
    const provider = createGitHubProvider({
      transport: createMockTransport({
        "/repos/openai/codex": createRepositoryModel(),
        "/repos/openai/codex/contents/README.md": createContentModel("README.md", "# Hello"),
        "/repos/openai/codex/issues/1": createIssueModel(1)
      })
    });
    const capabilities: CapabilityTestMatrix = createCapabilityTestMatrix([
      {
        capability: "files",
        requirement: "required",
        run: async (session) => {
          await expect(session.capabilities.files.readText("README.md")).resolves.toBe("# Hello");
        }
      },
      {
        capability: "issues",
        requirement: "optional",
        run: async (session) => {
          await expect(session.capabilities.issues?.get(1)).resolves.toMatchObject({
            number: 1,
            title: "Issue 1"
          });
        }
      }
    ]);

    const result = await runProviderContractSuite({
      capabilities,
      provider,
      repository: { url: "https://github.com/openai/codex" }
    });

    expect(result).toMatchObject({
      provider: "github",
      status: "passed"
    });
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "provider registration compatibility", status: "passed" }),
        expect.objectContaining({ name: "files capability behavior", status: "passed" }),
        expect.objectContaining({ name: "issues capability behavior", status: "passed" })
      ])
    );
  });
});

function createMockTransport(routes: Readonly<Record<string, unknown>>): Transport {
  return {
    async execute<TBody = unknown>(request: TransportRequest): Promise<TransportResponse<TBody>> {
      const route = routes[request.target];

      if (route === undefined) {
        return { status: 404 };
      }

      return { body: route as TBody, status: 200 };
    }
  };
}

function createRepositoryModel() {
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

function createContentModel(path: string, text: string) {
  return {
    content: Buffer.from(text, "utf8").toString("base64"),
    download_url: `https://raw.githubusercontent.com/openai/codex/main/${path}`,
    encoding: "base64",
    html_url: `https://github.com/openai/codex/blob/main/${path}`,
    name: path.split("/").pop() ?? path,
    path,
    sha: "blob-sha",
    size: text.length,
    type: "file"
  };
}

function createIssueModel(number: number) {
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
