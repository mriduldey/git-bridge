# Basic Node Example

Opens a GitHub repository with the public RepoFerry client and prints repository metadata.

## Run

```sh
pnpm --filter @repoferry/example-basic-node build
pnpm --filter @repoferry/example-basic-node start
```

Optional environment variables:

- `REPOFERRY_GITHUB_TOKEN`: GitHub token for higher rate limits or private repositories.
- `REPOFERRY_REPOSITORY_URL`: repository URL. Defaults to `https://github.com/octokit/rest.js`.
