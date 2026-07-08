import { GitBridgeError } from "@gitbridge/errors";
import { createGitHubClient } from "@gitbridge/provider-github";

const repositoryUrl = process.env.GITBRIDGE_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const token = process.env.GITBRIDGE_GITHUB_TOKEN;

const client = createGitHubClient(token === undefined ? {} : { token });

try {
  const repository = await client.open(repositoryUrl);
  const reference = repository.defaultRef();
  const commits = await reference.commits.list({ limit: 5 });

  for (const commit of commits.items) {
    const title = commit.message.split("\n", 1)[0] ?? "";
    console.log(`${commit.sha.slice(0, 7)} ${title}`);
  }

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
