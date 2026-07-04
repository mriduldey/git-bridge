import type { DeepReadonly, OperationOptions, SortDirection } from "../types/index.js";

export type PageCursor = string;

export type PaginationRequest = DeepReadonly<{
  cursor?: PageCursor;
  limit?: number;
}>;

export type PaginationInfo = DeepReadonly<{
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: PageCursor;
  endCursor?: PageCursor;
  totalCount?: number;
}>;

export type PagedResult<TItem> = DeepReadonly<{
  items: readonly TItem[];
  pageInfo: PaginationInfo;
}>;

export type ListOptions<TSort extends string = string> = OperationOptions &
  PaginationRequest &
  DeepReadonly<{
    sortBy?: TSort;
    sortDirection?: SortDirection;
  }>;
