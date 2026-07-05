export type GitHubUserModel = Readonly<{
  id?: number | string;
  login?: string;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  type?: string;
}>;

export type GitHubRepositoryModel = Readonly<{
  archived?: boolean;
  created_at?: string | null;
  default_branch?: string | null;
  description?: string | null;
  fork?: boolean;
  full_name?: string;
  html_url?: string;
  license?: Readonly<{
    key?: string | null;
    name?: string | null;
    spdx_id?: string | null;
    url?: string | null;
  }> | null;
  name?: string;
  owner?: GitHubUserModel;
  private?: boolean;
  updated_at?: string | null;
  visibility?: string | null;
}>;

export type GitHubBranchModel = Readonly<{
  commit?: Readonly<{
    sha?: string;
    url?: string;
  }>;
  name?: string;
  protected?: boolean;
}>;

export type GitHubRefModel = Readonly<{
  object?: Readonly<{
    sha?: string;
    type?: string;
    url?: string;
  }>;
  ref?: string;
  url?: string;
}>;

export type GitHubCommitModel = Readonly<{
  author?: GitHubUserModel | null;
  commit?: Readonly<{
    author?: GitHubGitActorModel | null;
    committer?: GitHubGitActorModel | null;
    message?: string;
    tree?: Readonly<{
      sha?: string;
      url?: string;
    }>;
    verification?: Readonly<{
      payload?: string | null;
      reason?: string | null;
      signature?: string | null;
      verified?: boolean;
    }> | null;
  }>;
  html_url?: string;
  parents?: readonly Readonly<{
    sha?: string;
    url?: string;
  }>[];
  sha?: string;
}>;

export type GitHubGitActorModel = Readonly<{
  date?: string | null;
  email?: string | null;
  name?: string | null;
}>;

export type GitHubTreeModel = Readonly<{
  sha?: string;
  tree?: readonly GitHubTreeNodeModel[];
  truncated?: boolean;
  url?: string;
}>;

export type GitHubTreeNodeModel = Readonly<{
  mode?: string;
  path?: string;
  sha?: string;
  size?: number;
  type?: "blob" | "tree" | "commit" | string;
  url?: string;
}>;

export type GitHubContentModel = Readonly<{
  content?: string | null;
  download_url?: string | null;
  encoding?: string | null;
  html_url?: string | null;
  name?: string;
  path?: string;
  sha?: string;
  size?: number;
  type?: "file" | "dir" | "symlink" | "submodule" | string;
}>;

export type GitHubBlobModel = Readonly<{
  content?: string | null;
  encoding?: string | null;
  sha?: string;
  size?: number;
  url?: string;
}>;

export type GitHubIssueModel = Readonly<{
  assignees?: readonly GitHubUserModel[] | null;
  body?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  html_url?: string;
  id?: number | string;
  labels?: readonly (string | Readonly<{ name?: string | null }>)[];
  number?: number;
  pull_request?: unknown;
  state?: string;
  title?: string;
  updated_at?: string | null;
  user?: GitHubUserModel | null;
}>;

export type GitHubPullRequestModel = Readonly<{
  base?: GitHubPullRequestRefModel;
  body?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  head?: GitHubPullRequestRefModel;
  html_url?: string;
  id?: number | string;
  merged?: boolean;
  merged_at?: string | null;
  number?: number;
  state?: string;
  title?: string;
  updated_at?: string | null;
  user?: GitHubUserModel | null;
}>;

export type GitHubPullRequestRefModel = Readonly<{
  ref?: string;
  repo?: GitHubRepositoryModel | null;
  sha?: string;
}>;

export type GitHubReleaseModel = Readonly<{
  assets?: readonly Readonly<{
    browser_download_url?: string;
    content_type?: string;
    created_at?: string | null;
    name?: string;
    size?: number;
  }>[];
  author?: GitHubUserModel | null;
  body?: string | null;
  created_at?: string | null;
  draft?: boolean;
  html_url?: string;
  id?: number | string;
  name?: string | null;
  prerelease?: boolean;
  published_at?: string | null;
  tag_name?: string;
}>;

export type GitHubSearchItemKind = "file" | "commit" | "issue" | "pull-request" | "release";

export type GitHubSearchItemModel = Readonly<{
  html_url?: string;
  name?: string;
  number?: number;
  path?: string;
  score?: number;
  sha?: string;
  state?: string;
  title?: string;
  type?: GitHubSearchItemKind | string;
}>;

export type GitHubSearchResponseModel = Readonly<{
  incomplete_results?: boolean;
  items?: readonly GitHubSearchItemModel[];
  total_count?: number;
}>;
