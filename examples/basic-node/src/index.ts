import { createAuthContext, tokenAuth } from "@gitbridge/auth";
import { createGitBridgeClient, type AuthenticationStrategy } from "@gitbridge/core";
import { GitBridgeError } from "@gitbridge/errors";
import { createGitHubProviderConfig, GitHubProviderId } from "@gitbridge/provider-github";

const repositoryUrl = process.env.GITBRIDGE_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const token = process.env.GITBRIDGE_GITHUB_TOKEN;

const authentication: AuthenticationStrategy | undefined =
  token === undefined
    ? undefined
    : {
        type: "token",
        async authenticate() {
          return createAuthContext(tokenAuth({ provider: GitHubProviderId, token }));
        }
      };

const client = createGitBridgeClient({
  ...createGitHubProviderConfig(),
  authentication
});

try {
  const repository = await client.open(repositoryUrl);

  console.log(`Opened ${repository.info.fullName}`);
  console.log(`Provider: ${repository.identity.provider}`);
  console.log(`Default branch: ${repository.info.defaultBranch ?? "unknown"}`);

  await repository.dispose();
} catch (error: unknown) {
  if (error instanceof GitBridgeError) {
    console.error(`${error.code}: ${error.message}`);
    console.error(JSON.stringify(error.diagnostics, null, 2));
  } else {
    throw error;
  }
} finally {
  await client.dispose();
}
