import { SourceAxisError } from "@sourceaxis/errors";
import { createGitHubClient } from "@sourceaxis/provider-github";

const repositoryUrl = process.env.SOURCEAXIS_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const token = process.env.SOURCEAXIS_GITHUB_TOKEN;

const client = createGitHubClient(token === undefined ? {} : { token });

try {
  const repository = await client.open(repositoryUrl);

  console.log(`Opened ${repository.info.fullName}`);
  console.log(`Provider: ${repository.identity.provider}`);
  console.log(`Default branch: ${repository.info.defaultBranch ?? "unknown"}`);

  await repository.dispose();
} catch (error: unknown) {
  if (error instanceof SourceAxisError) {
    console.error(`${error.code}: ${error.message}`);
    console.error(JSON.stringify(error.diagnostics, null, 2));
  } else {
    throw error;
  }
} finally {
  await client.dispose();
}
