import { SourceAxisError } from "@sourceaxis/errors";
import { createGitHubClient } from "@sourceaxis/provider-github";

const repositoryUrl = process.env.SOURCEAXIS_REPOSITORY_URL ?? "https://github.com/octokit/rest.js";
const path = process.env.SOURCEAXIS_FILE_PATH ?? "README.md";
const token = process.env.SOURCEAXIS_GITHUB_TOKEN;

const client = createGitHubClient(token === undefined ? {} : { token });

try {
  const repository = await client.open(repositoryUrl);
  const content = await repository.readText(path);

  console.log(`Read ${path} from ${repository.info.fullName}`);
  console.log(content.slice(0, 5000));

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
