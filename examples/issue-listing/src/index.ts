import { RepoFerryError } from "@repoferry/errors";
import { createGitHubClient } from "@repoferry/provider-github";

const repositoryUrl = process.env.REPOFERRY_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const token = process.env.REPOFERRY_GITHUB_TOKEN;

const client = createGitHubClient(token === undefined ? {} : { token });

try {
  const repository = await client.open(repositoryUrl);
  const reference = repository.defaultRef();
  const issues = await reference.issues?.list({ limit: 10 });

  if (issues === undefined) {
    throw new RepoFerryError("Repository does not expose the issues capability");
  }

  for (const issue of issues.items) {
    console.log(`#${issue.number} [${issue.state}] ${issue.title}`);
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
