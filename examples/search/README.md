# Search

Searches code in a GitHub repository. GitHub code search usually requires authenticated access, so
set `SOURCEAXIS_GITHUB_TOKEN`.

## Run

```sh
pnpm --filter @sourceaxis/example-search build
pnpm --filter @sourceaxis/example-search start
```

Optional environment variables:

- `SOURCEAXIS_GITHUB_TOKEN`
- `SOURCEAXIS_REPOSITORY_URL`
- `SOURCEAXIS_SEARCH_QUERY`, defaulting to `Octokit`
