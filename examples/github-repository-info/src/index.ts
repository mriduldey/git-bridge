import { SourceAxisError } from "@sourceaxis/errors";
import { createGitHubClient } from "@sourceaxis/provider-github";

const repositoryUrl = process.env.SOURCEAXIS_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const token = process.env.SOURCEAXIS_GITHUB_TOKEN;

const client = createGitHubClient(token === undefined ? {} : { token });

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
  if (error instanceof SourceAxisError) {
    console.error(`${error.code}: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await client.dispose();
}
