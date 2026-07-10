# Basic Node Example

Opens a GitHub repository with the public SourceAxis client and prints repository metadata.

## Run

```sh
pnpm --filter @sourceaxis/example-basic-node build
pnpm --filter @sourceaxis/example-basic-node start
```

Optional environment variables:

- `SOURCEAXIS_GITHUB_TOKEN`: GitHub token for higher rate limits or private repositories.
- `SOURCEAXIS_REPOSITORY_URL`: repository URL. Defaults to `https://github.com/octokit/rest.js`.
