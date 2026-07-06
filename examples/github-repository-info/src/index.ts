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
  const info = repository.info;

  console.log({
    defaultBranch: info.defaultBranch,
    description: info.description,
    fullName: info.fullName,
    isArchived: info.isArchived,
    isFork: info.isFork,
    license: info.license?.spdxId ?? info.license?.name,
    owner: "username" in info.owner ? info.owner.username : info.owner.name,
    url: info.url,
    visibility: info.visibility
  });

  await repository.dispose();
} catch (error: unknown) {
  if (error instanceof GitBridgeError) {
    console.error(`${error.code}: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await client.dispose();
}
