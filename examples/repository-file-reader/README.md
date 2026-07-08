# Repository File Reader

Reads a text file from the default branch of a GitHub repository.

## Run

```sh
pnpm --filter @repoferry/example-repository-file-reader build
pnpm --filter @repoferry/example-repository-file-reader start
```

Optional environment variables:

- `REPOFERRY_GITHUB_TOKEN`
- `REPOFERRY_REPOSITORY_URL`
- `REPOFERRY_FILE_PATH`, defaulting to `README.md`
