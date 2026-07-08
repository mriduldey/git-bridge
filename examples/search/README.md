# Search

Searches code in a GitHub repository. GitHub code search usually requires authenticated access, so
set `REPOFERRY_GITHUB_TOKEN`.

## Run

```sh
pnpm --filter @repoferry/example-search build
pnpm --filter @repoferry/example-search start
```

Optional environment variables:

- `REPOFERRY_GITHUB_TOKEN`
- `REPOFERRY_REPOSITORY_URL`
- `REPOFERRY_SEARCH_QUERY`, defaulting to `Octokit`
