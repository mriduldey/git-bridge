import type { DeepReadonly, JsonValue } from "../types/index.js";

export type ProviderId = string;
export type RepositoryName = string;
export type OwnerName = string;
export type OrganizationName = string;
export type BranchName = string;
export type TagName = string;
export type ReferenceName = string;
export type CommitSha = string;
export type TreeSha = string;
export type BlobSha = string;
export type FilePath = string;
export type RepositoryUrl = string;
export type UserId = string;
export type OrganizationId = string;
export type ReleaseId = string;
export type IssueId = string;
export type PullRequestId = string;
export type CapabilityName = string;

export type Timestamp = string;

export type LinkRelation =
  "self" | "repository" | "owner" | "tree" | "blob" | "download" | "html" | "next" | "previous";

export type Link = DeepReadonly<{
  rel: LinkRelation;
  href: string;
  mediaType?: string;
}>;

export type Metadata = DeepReadonly<{
  provider?: ProviderId;
  links?: readonly Link[];
  etag?: string;
  lastModified?: Timestamp;
  requestId?: string;
  extra?: Readonly<Record<string, JsonValue>>;
}>;

export type DateRange = DeepReadonly<{
  since?: Timestamp;
  until?: Timestamp;
}>;
