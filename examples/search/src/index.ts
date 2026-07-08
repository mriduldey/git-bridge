import { RepoFerryError } from "@repoferry/errors";
import { createGitHubClient } from "@repoferry/provider-github";

const repositoryUrl = process.env.REPOFERRY_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const query = process.env.REPOFERRY_SEARCH_QUERY ?? "Octokit";
const token = process.env.REPOFERRY_GITHUB_TOKEN;

if (token === undefined) {
  console.error("REPOFERRY_GITHUB_TOKEN is required for the search example.");
  process.exit(1);
}

const client = createGitHubClient({ token });

try {
  const repository = await client.open(repositoryUrl);
  const reference = repository.defaultRef();
  const results = await reference.search.text(query, { limit: 5 });

  for (const result of results.items) {
    console.log(`${result.score}: ${JSON.stringify(result.item)}`);
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
