import type { Metadata, ProviderId, RepositoryName } from "../metadata/index.js";
import type { DeepReadonly, JsonValue } from "../types/index.js";

export type DiagnosticEventKind =
  "repository" | "transport" | "authentication" | "cache" | "error" | "provider";

export type DiagnosticContext = DeepReadonly<{
  operation?: string;
  capability?: string;
  provider?: ProviderId;
  repository?: RepositoryName;
  reference?: string;
  path?: string;
  correlationId?: string;
  metadata?: Metadata;
}>;

export type DiagnosticEvent = DeepReadonly<{
  id: string;
  kind: DiagnosticEventKind;
  name: string;
  schemaVersion: string;
  timestamp: string;
  context?: DiagnosticContext;
  data?: Readonly<Record<string, JsonValue>>;
}>;

export type DiagnosticSubscriber = (event: DiagnosticEvent) => void | Promise<void>;

export interface DiagnosticsService {
  publish(event: DiagnosticEvent): Promise<void>;
  subscribe(subscriber: DiagnosticSubscriber): Promise<() => Promise<void>>;
}
