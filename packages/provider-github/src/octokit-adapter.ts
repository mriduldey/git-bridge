import { Octokit } from "@octokit/rest";

import type { AuthenticationContext } from "@gitbridge/contracts";
import { deepFreeze } from "@gitbridge/shared";

import type {
  GitHubOctokitAdapter,
  GitHubOctokitAdapterContext,
  GitHubOctokitRequest,
  GitHubOctokitResponse
} from "./index.js";

type OctokitRequestFunction = <TBody = unknown>(
  route: string,
  parameters?: Readonly<Record<string, unknown>>
) => Promise<
  Readonly<{ data?: TBody; headers?: Readonly<Record<string, string>>; status: number }>
>;

export type InternalOctokitClient = Readonly<{
  request: OctokitRequestFunction;
}>;

export type InternalOctokitAdapterOptions = Readonly<{
  client?: InternalOctokitClient;
}>;

export function createOctokitAdapter(
  context: GitHubOctokitAdapterContext,
  options: InternalOctokitAdapterOptions = {}
): GitHubOctokitAdapter {
  const client = options.client ?? createOctokitClient(context.authentication);

  return deepFreeze({
    async request<TBody = unknown>(
      request: GitHubOctokitRequest
    ): Promise<GitHubOctokitResponse<TBody>> {
      const response = await client.request<TBody>(
        `${request.method ?? "GET"} ${request.url}`,
        createOctokitParameters(request)
      );

      return deepFreeze({
        data: response.data,
        headers: response.headers,
        status: response.status
      }) as GitHubOctokitResponse<TBody>;
    }
  }) as GitHubOctokitAdapter;
}

function createOctokitClient(
  authentication: AuthenticationContext | undefined
): InternalOctokitClient {
  const token = getAuthenticationToken(authentication);
  const options: { auth?: string } = {};

  if (token !== undefined) {
    options.auth = token;
  }

  return new Octokit(options) as unknown as InternalOctokitClient;
}

function createOctokitParameters(request: GitHubOctokitRequest): Readonly<Record<string, unknown>> {
  const parameters: Record<string, unknown> = {};

  if (request.body !== undefined) {
    parameters.data = request.body;
  }

  if (request.headers !== undefined) {
    parameters.headers = request.headers;
  }

  if (request.signal !== undefined) {
    parameters.request = { signal: request.signal };
  }

  if (request.timeoutMs !== undefined) {
    parameters.request = {
      ...(typeof parameters.request === "object" && parameters.request !== null
        ? parameters.request
        : {}),
      timeout: request.timeoutMs
    };
  }

  return deepFreeze(parameters);
}

function getAuthenticationToken(
  authentication: AuthenticationContext | undefined
): string | undefined {
  const credentials = authentication?.credentials;

  if (credentials === undefined || credentials.kind === "anonymous" || !("token" in credentials)) {
    return undefined;
  }

  return typeof credentials.token === "string" ? credentials.token : undefined;
}
