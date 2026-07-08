import { RepoFerryError } from "@repoferry/errors";
import { createGitHubClient } from "@repoferry/provider-github";

const repositoryUrl = process.env.REPOFERRY_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const path = process.env.REPOFERRY_FILE_PATH ?? "README.md";
const token = process.env.REPOFERRY_GITHUB_TOKEN;

const client = createGitHubClient(token === undefined ? {} : { token });

try {
  const repository = await client.open(repositoryUrl);
  const content = await repository.readText(path);

  console.log(`Read ${path} from ${repository.info.fullName}`);
  console.log(content.slice(0, 5000));

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
