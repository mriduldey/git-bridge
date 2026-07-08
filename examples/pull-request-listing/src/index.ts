import { RepoFerryError } from "@repoferry/errors";
import { createGitHubClient } from "@repoferry/provider-github";

const repositoryUrl = process.env.REPOFERRY_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const token = process.env.REPOFERRY_GITHUB_TOKEN;

const client = createGitHubClient(token === undefined ? {} : { token });

try {
  const repository = await client.open(repositoryUrl);
  const reference = repository.defaultRef();
  const pullRequests = await reference.pullRequests?.list({ limit: 10 });

  if (pullRequests === undefined) {
    throw new RepoFerryError("Repository does not expose the pull requests capability");
  }

  for (const pullRequest of pullRequests.items) {
    console.log(`#${pullRequest.number} [${pullRequest.state}] ${pullRequest.title}`);
  }

  await repository.dispose();
} catch (error: unknown) {
  if (error instanceof RepoFerryError) {
    console.error(`${error.code}: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await client.dispose();
}
