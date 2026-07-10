import type {
  Blob,
  Branch,
  Commit,
  FileInfo,
  Issue,
  PullRequest,
  Reference,
  Release,
  RepositoryIdentity,
  RepositoryInfo,
  RepositoryOwner,
  SearchResult,
  Tag,
  Tree,
  TreeNode
} from "@sourceaxis/contracts";
import { ValidationError, type ErrorDiagnostics } from "@sourceaxis/errors";
import { deepFreeze } from "@sourceaxis/shared";

import { GitHubProviderId } from "./constants.js";
import type {
  GitHubBlobModel,
  GitHubBranchModel,
  GitHubCommitModel,
  GitHubContentModel,
  GitHubGitActorModel,
  GitHubIssueModel,
  GitHubPullRequestModel,
  GitHubRefModel,
  GitHubReleaseModel,
  GitHubRepositoryModel,
  GitHubSearchItemModel,
  GitHubTreeModel,
  GitHubTreeNodeModel,
  GitHubUserModel
} from "./github-models.js";

export function mapGitHubRepository(
  model: GitHubRepositoryModel,
  fallback: RepositoryIdentity
): RepositoryInfo {
  const identity = deepFreeze({
    name: requiredString(model.name ?? fallback.name, "GitHub repository name is missing"),
    owner: requiredString(
      model.owner?.login ?? fallback.owner,
      "GitHub repository owner is missing"
    ),
    provider: GitHubProviderId
  }) as RepositoryIdentity;

  const info: RepositoryInfo = deepFreeze({
    createdAt: model.created_at ?? undefined,
    defaultBranch: model.default_branch ?? undefined,
    description: model.description ?? undefined,
    fullName: model.full_name ?? `${identity.owner}/${identity.name}`,
    identity,
    isArchived: model.archived,
    isFork: model.fork,
    license:
      model.license === null || model.license === undefined
        ? undefined
        : {
            key: requiredString(model.license.key ?? undefined, "GitHub license key is missing"),
            name: requiredString(model.license.name ?? undefined, "GitHub license name is missing"),
            spdxId: model.license.spdx_id ?? undefined,
            url: model.license.url ?? undefined
          },
    metadata: { provider: GitHubProviderId },
    name: identity.name,
    owner: mapGitHubOwner(model.owner, identity.owner),
    updatedAt: model.updated_at ?? undefined,
    url: model.html_url ?? `https://github.com/${identity.owner}/${identity.name}`,
    visibility: mapRepositoryVisibility(model)
  }) as RepositoryInfo;

  return info;
}

export function mapGitHubBranch(model: GitHubBranchModel, repository: RepositoryIdentity): Branch {
  const name = requiredString(model.name, "GitHub branch name is missing");

  return deepFreeze({
    default: false,
    metadata: { provider: GitHubProviderId },
    name,
    protected: model.protected,
    repository,
    target: requiredString(model.commit?.sha, "GitHub branch commit sha is missing"),
    type: "branch"
  }) as Branch;
}

export function mapGitHubTag(model: GitHubRefModel, repository: RepositoryIdentity): Tag {
  const name = refName(model.ref, "tags");

  return deepFreeze({
    metadata: { provider: GitHubProviderId },
    name,
    repository,
    target: requiredString(model.object?.sha, "GitHub tag target sha is missing"),
    type: "tag"
  }) as Tag;
}

export function mapGitHubRef(model: GitHubRefModel, repository: RepositoryIdentity): Reference {
  const ref = requiredString(model.ref, "GitHub ref name is missing");
  const type = ref.startsWith("refs/tags/")
    ? "tag"
    : ref.startsWith("refs/pull/")
      ? "pull-request"
      : ref.startsWith("refs/heads/")
        ? "branch"
        : "detached";

  return deepFreeze({
    metadata: { provider: GitHubProviderId },
    name: ref.replace(/^refs\/(?:heads|tags)\//u, ""),
    repository,
    target: requiredString(model.object?.sha, "GitHub ref target sha is missing"),
    type
  }) as Reference;
}

export function mapGitHubCommit(model: GitHubCommitModel): Commit {
  const sha = requiredString(model.sha, "GitHub commit sha is missing");

  return deepFreeze({
    author: mapGitActor(model.commit?.author, model.author),
    committer:
      model.commit?.committer === undefined || model.commit.committer === null
        ? undefined
        : mapGitActor(model.commit.committer),
    message: model.commit?.message ?? "",
    metadata: { provider: GitHubProviderId },
    parents: (model.parents ?? []).flatMap((parent) =>
      parent.sha === undefined ? [] : [{ sha: parent.sha, url: parent.url }]
    ),
    sha,
    tree: requiredString(model.commit?.tree?.sha, "GitHub commit tree sha is missing"),
    url: model.html_url,
    verification:
      model.commit?.verification === undefined || model.commit.verification === null
        ? undefined
        : {
            reason: model.commit.verification.reason ?? undefined,
            signature: model.commit.verification.signature ?? undefined,
            status: model.commit.verification.verified === true ? "verified" : "unverified"
          }
  }) as Commit;
}

export function mapGitHubTree(model: GitHubTreeModel, path = ""): Tree {
  return deepFreeze({
    metadata: { provider: GitHubProviderId },
    nodes: (model.tree ?? []).map(mapGitHubTreeNode),
    path,
    sha: requiredString(model.sha, "GitHub tree sha is missing"),
    truncated: model.truncated
  }) as Tree;
}

export function mapGitHubTreeNode(model: GitHubTreeNodeModel): TreeNode {
  const path = requiredString(model.path, "GitHub tree node path is missing");

  return deepFreeze({
    metadata: { provider: GitHubProviderId },
    mode: model.mode,
    name: path.split("/").pop() ?? path,
    path,
    sha: model.sha,
    size: model.size,
    type: mapTreeNodeType(model.type)
  }) as TreeNode;
}

export function mapGitHubContentToFileInfo(model: GitHubContentModel): FileInfo {
  const path = requiredString(model.path, "GitHub content path is missing");

  return deepFreeze({
    downloadUrl: model.download_url ?? undefined,
    metadata: {
      links: model.html_url === undefined ? undefined : [{ href: model.html_url, rel: "html" }],
      provider: GitHubProviderId
    },
    name: model.name ?? path.split("/").pop() ?? path,
    path,
    sha: model.sha,
    size: model.size
  }) as FileInfo;
}

export function mapGitHubContentToBlob(model: GitHubContentModel): Blob {
  return deepFreeze({
    content: model.content === null || model.content === undefined ? undefined : model.content,
    encoding: model.encoding === "base64" ? "base64" : "utf-8",
    metadata: { provider: GitHubProviderId },
    path: requiredString(model.path, "GitHub content path is missing"),
    sha: requiredString(model.sha, "GitHub content sha is missing"),
    size: model.size ?? 0
  }) as Blob;
}

export function mapGitHubBlob(model: GitHubBlobModel, path: string): Blob {
  return deepFreeze({
    content: model.content === null || model.content === undefined ? undefined : model.content,
    encoding: model.encoding === "base64" ? "base64" : "utf-8",
    metadata: { provider: GitHubProviderId },
    path,
    sha: requiredString(model.sha, "GitHub blob sha is missing"),
    size: model.size ?? 0
  }) as Blob;
}

export function mapGitHubContentToTreeNode(model: GitHubContentModel): TreeNode {
  const path = requiredString(model.path, "GitHub content path is missing");

  return deepFreeze({
    metadata: { provider: GitHubProviderId },
    name: model.name ?? path.split("/").pop() ?? path,
    path,
    sha: model.sha,
    size: model.size,
    type: mapContentType(model.type)
  }) as TreeNode;
}

export function mapGitHubIssue(model: GitHubIssueModel): Issue {
  return deepFreeze({
    assignees: (model.assignees ?? undefined)?.map((assignee) =>
      mapGitHubUser(assignee, assignee.login ?? "unknown")
    ),
    author:
      model.user === null || model.user === undefined
        ? undefined
        : mapGitHubUser(model.user, model.user.login ?? "unknown"),
    body: model.body ?? undefined,
    closedAt: model.closed_at ?? undefined,
    createdAt: model.created_at ?? undefined,
    id: model.id === undefined ? undefined : String(model.id),
    labels: (model.labels ?? []).flatMap((label) => {
      if (typeof label === "string") {
        return [label];
      }

      return label.name === undefined || label.name === null ? [] : [label.name];
    }),
    metadata: {
      links: model.html_url === undefined ? undefined : [{ href: model.html_url, rel: "html" }],
      provider: GitHubProviderId
    },
    number: requiredNumber(model.number, "GitHub issue number is missing"),
    state: model.state === "closed" ? "closed" : "open",
    title: requiredString(model.title, "GitHub issue title is missing"),
    updatedAt: model.updated_at ?? undefined
  }) as Issue;
}

export function mapGitHubPullRequest(
  model: GitHubPullRequestModel,
  repository: RepositoryIdentity
): PullRequest {
  return deepFreeze({
    author:
      model.user === null || model.user === undefined
        ? undefined
        : mapGitHubUser(model.user, model.user.login ?? "unknown"),
    body: model.body ?? undefined,
    closedAt: model.closed_at ?? undefined,
    createdAt: model.created_at ?? undefined,
    id: model.id === undefined ? undefined : String(model.id),
    mergeStatus: model.merged === true ? "clean" : "unknown",
    mergedAt: model.merged_at ?? undefined,
    metadata: {
      links: model.html_url === undefined ? undefined : [{ href: model.html_url, rel: "html" }],
      provider: GitHubProviderId
    },
    number: requiredNumber(model.number, "GitHub pull request number is missing"),
    source: {
      branch: requiredString(model.head?.ref, "GitHub pull request source branch is missing"),
      repository: mapPullRequestRepository(model.head?.repo, repository),
      sha: model.head?.sha
    },
    state: model.merged === true ? "merged" : model.state === "closed" ? "closed" : "open",
    target: {
      branch: requiredString(model.base?.ref, "GitHub pull request target branch is missing"),
      repository: mapPullRequestRepository(model.base?.repo, repository),
      sha: model.base?.sha
    },
    title: requiredString(model.title, "GitHub pull request title is missing"),
    updatedAt: model.updated_at ?? undefined
  }) as PullRequest;
}

export function mapGitHubRelease(model: GitHubReleaseModel): Release {
  return deepFreeze({
    assets: (model.assets ?? []).map((asset) => ({
      contentType: asset.content_type,
      createdAt: asset.created_at ?? undefined,
      downloadUrl: asset.browser_download_url,
      metadata: { provider: GitHubProviderId },
      name: requiredString(asset.name, "GitHub release asset name is missing"),
      size: asset.size
    })),
    author:
      model.author === null || model.author === undefined
        ? undefined
        : mapGitHubUser(model.author, model.author.login ?? "unknown"),
    body: model.body ?? undefined,
    createdAt: model.created_at ?? undefined,
    id: model.id === undefined ? undefined : String(model.id),
    metadata: {
      links: model.html_url === undefined ? undefined : [{ href: model.html_url, rel: "html" }],
      provider: GitHubProviderId
    },
    name: model.name ?? undefined,
    publishedAt: model.published_at ?? undefined,
    state: model.draft === true ? "draft" : model.prerelease === true ? "prerelease" : "published",
    tagName: requiredString(model.tag_name, "GitHub release tag name is missing")
  }) as Release;
}

export function mapGitHubSearchItem(model: GitHubSearchItemModel): SearchResult {
  const kind = mapSearchKind(model);
  const path = model.path ?? model.name ?? model.title ?? model.sha ?? "result";

  return deepFreeze({
    item: {
      downloadUrl: model.html_url,
      metadata: { provider: GitHubProviderId },
      name: path.split("/").pop() ?? path,
      path,
      sha: model.sha
    },
    kind,
    score: model.score
  }) as SearchResult;
}

function mapGitHubOwner(model: GitHubUserModel | undefined, fallback: string): RepositoryOwner {
  if (model?.type === "Organization") {
    return deepFreeze({
      avatarUrl: model.avatar_url ?? undefined,
      displayName: model.name ?? model.login ?? fallback,
      id: model.id === undefined ? undefined : String(model.id),
      name: model.login ?? fallback,
      url: model.html_url ?? undefined
    }) as RepositoryOwner;
  }

  return deepFreeze({
    avatarUrl: model?.avatar_url ?? undefined,
    displayName: model?.name ?? model?.login ?? fallback,
    id: model?.id === undefined ? undefined : String(model.id),
    url: model?.html_url ?? undefined,
    username: model?.login ?? fallback
  }) as RepositoryOwner;
}

function mapGitHubUser(model: GitHubUserModel, fallback: string) {
  return deepFreeze({
    avatarUrl: model.avatar_url ?? undefined,
    displayName: model.name ?? model.login ?? fallback,
    id: model.id === undefined ? undefined : String(model.id),
    url: model.html_url ?? undefined,
    username: model.login ?? fallback
  });
}

function mapRepositoryVisibility(model: GitHubRepositoryModel): RepositoryInfo["visibility"] {
  if (model.visibility === "internal") {
    return "internal";
  }

  if (model.private === true || model.visibility === "private") {
    return "private";
  }

  if (model.private === false || model.visibility === "public") {
    return "public";
  }

  return "unknown";
}

function mapGitActor(model: GitHubGitActorModel | null | undefined, user?: GitHubUserModel | null) {
  return deepFreeze({
    date: model?.date ?? undefined,
    email: model?.email ?? undefined,
    name: model?.name ?? user?.login ?? "unknown",
    user:
      user === null || user === undefined
        ? undefined
        : mapGitHubOwner(user, user.login ?? "unknown")
  });
}

function mapPullRequestRepository(
  model: GitHubRepositoryModel | null | undefined,
  fallback: RepositoryIdentity
): RepositoryIdentity {
  if (model === null || model === undefined) {
    return fallback;
  }

  return {
    name: model.name ?? fallback.name,
    owner: model.owner?.login ?? fallback.owner,
    provider: GitHubProviderId
  };
}

function mapSearchKind(model: GitHubSearchItemModel): SearchResult["kind"] {
  if (model.type === "commit") {
    return "commit";
  }

  if (model.type === "issue") {
    return "issue";
  }

  if (model.type === "pull-request" || model.number !== undefined) {
    return "pull-request";
  }

  if (model.type === "release") {
    return "release";
  }

  return "file";
}

function mapTreeNodeType(type: GitHubTreeNodeModel["type"]): TreeNode["type"] {
  if (type === "tree") {
    return "directory";
  }

  if (type === "commit") {
    return "submodule";
  }

  return "file";
}

function mapContentType(type: GitHubContentModel["type"]): TreeNode["type"] {
  if (type === "dir") {
    return "directory";
  }

  if (type === "symlink") {
    return "symlink";
  }

  if (type === "submodule") {
    return "submodule";
  }

  return "file";
}

function refName(ref: string | undefined, namespace: "heads" | "tags"): string {
  const full = requiredString(ref, "GitHub ref name is missing");
  return full.replace(new RegExp(`^refs/${namespace}/`, "u"), "");
}

function requiredString(value: string | undefined | null, message: string): string {
  if (value === undefined || value === null || value.trim() === "") {
    throw new ValidationError(message, {
      diagnostics: {
        operation: { operation: "github.map" },
        provider: { provider: GitHubProviderId }
      } satisfies ErrorDiagnostics
    });
  }

  return value;
}

function requiredNumber(value: number | undefined, message: string): number {
  if (value === undefined) {
    throw new ValidationError(message, {
      diagnostics: {
        operation: { operation: "github.map" },
        provider: { provider: GitHubProviderId }
      } satisfies ErrorDiagnostics
    });
  }

  return value;
}
