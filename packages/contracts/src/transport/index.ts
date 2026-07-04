import type { Metadata } from "../metadata/index.js";
import type { DeepReadonly, JsonValue, OperationOptions } from "../types/index.js";

export type TransportMethod = "read" | "write" | "delete" | "stream";
export type TransportBody = string | Uint8Array | JsonValue | AsyncIterable<Uint8Array>;

export type TransportRequest = OperationOptions &
  DeepReadonly<{
    id?: string;
    method: TransportMethod;
    target: string;
    headers?: Readonly<Record<string, string>>;
    body?: TransportBody;
    stream?: boolean;
    metadata?: Metadata;
  }>;

export type TransportResponse<TBody = unknown> = DeepReadonly<{
  status: number;
  body?: TBody;
  headers?: Readonly<Record<string, string>>;
  metadata?: Metadata;
}>;

export type TransportContext = DeepReadonly<{
  metadata?: Metadata;
}>;

export interface Transport {
  execute<TBody = unknown>(
    request: TransportRequest,
    context?: TransportContext
  ): Promise<TransportResponse<TBody>>;
}
