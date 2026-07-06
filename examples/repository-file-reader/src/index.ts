import { createAuthContext, tokenAuth } from "@gitbridge/auth";
import { createGitBridgeClient, type AuthenticationStrategy } from "@gitbridge/core";
import { GitBridgeError } from "@gitbridge/errors";
import { createGitHubProviderConfig, GitHubProviderId } from "@gitbridge/provider-github";

const repositoryUrl = process.env.GITBRIDGE_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const path = process.env.GITBRIDGE_FILE_PATH ?? "README.md";
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
  const reference = repository.ref(repository.info.defaultBranch ?? "main");
  const content = await reference.files.readText(path);

  console.log(`Read ${path} from ${repository.info.fullName}`);
  console.log(content.slice(0, 500));

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
