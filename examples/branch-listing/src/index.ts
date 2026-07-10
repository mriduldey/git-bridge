import { SourceAxisError } from "@sourceaxis/errors";
import { createGitHubClient } from "@sourceaxis/provider-github";

const repositoryUrl = process.env.SOURCEAXIS_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const token = process.env.SOURCEAXIS_GITHUB_TOKEN;

const client = createGitHubClient(token === undefined ? {} : { token });

try {
  const repository = await client.open(repositoryUrl);
  const reference = repository.defaultRef();
  const branches = await reference.branches.list({ limit: 10 });

  for (const branch of branches.items) {
    console.log(`${branch.name} -> ${branch.target}`);
  }

  await repository.dispose();
} catch (error: unknown) {
  if (error instanceof SourceAxisError) {
    console.error(`${error.code}: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await client.dispose();
}
