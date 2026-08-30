import type { ZodType } from 'zod';
import type { JsonValue } from './json';
import type { RemoteFieldOption } from './remote-field-option';
import type { RemoteAccount } from './remote-account';
import type { RemoteIssueSearchResult } from './remote-issue-ref';
import type { RemoteTimeLogDto } from './remote-export';

/** A pure, transport-agnostic HTTP request description. */
export interface RemoteRequest {
  url: string;
  method: 'GET' | 'POST';
  /** JSON body for `POST`/form endpoints; unused by `GET` requests. */
  body?: JsonValue;
  /**
   * Provider-built request headers (e.g. auth). Transports merge these as-is
   * and never construct provider-specific credentials themselves.
   */
  headers?: Record<string, string>;
}

/** A pure, transport-agnostic HTTP response description. */
export interface RemoteResponse<T = JsonValue> {
  status: number;
  payload: T | null;
}

/**
 * L4: executes one neutral HTTP request and returns its status/payload,
 * without interpreting either. `clientFetchTransport` and `serverFetchTransport`
 * are the two concrete implementations selected by execution mode.
 * `schema` is the evidence for `T` (Doctor TS0004).
 */
export interface Transport {
  execute<T>(request: RemoteRequest, schema: ZodType<T>): Promise<RemoteResponse<T>>;
}

/**
 * L2: the use-case-shaped, provider-neutral operations every remote-tracker
 * adapter implements. Speaks only neutral DTOs; never leaks provider request/
 * response shapes to callers.
 */
export interface RemoteTrackerAdapter {
  searchIssues(query: string): Promise<RemoteIssueSearchResult[]>;
  getIssueById(remoteIssueId: string): Promise<RemoteIssueSearchResult | null>;
  getActivityOptions(remoteIssueId: string): Promise<RemoteFieldOption[]>;
  getCurrentAccount(): Promise<RemoteAccount>;
  fetchTimeLogs(input: {
    spentOn: string;
    workPackageIds: string[];
    userId?: string;
  }): Promise<RemoteTimeLogDto[]>;
  fetchTimeLogsInRange(input: {
    from: string;
    to: string;
    userId?: string;
  }): Promise<RemoteTimeLogDto[]>;
  createTimeEntry(input: {
    remoteIssueId: string;
    spentOn: string;
    durationSeconds: number;
    activityId: string;
    comment?: string;
  }): Promise<{ remoteLogId: string }>;
}

/**
 * Neutral adapter failure: carries a translation key and, when known, the
 * upstream HTTP status. Callers map it to their own error contract
 * (`createError` server-side, `errorKey` client-side) without inspecting
 * provider-specific detail.
 */
export class RemoteAdapterError extends Error {
  readonly messageKey: string;
  readonly status?: number;

  constructor(messageKey: string, status?: number) {
    super(messageKey);
    this.name = 'RemoteAdapterError';
    this.messageKey = messageKey;
    this.status = status;
  }
}
