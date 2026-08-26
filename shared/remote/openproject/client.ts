import type { RemoteFieldOption } from '../../types/remote-field-option';
import type { RemoteAccount } from '../../types/remote-account';
import type { RemoteIssueSearchResult } from '../../types/remote-issue-ref';
import { z } from 'zod';
import type { Transport } from '../../types/remote-adapter';
import { normalizeBaseUrl } from '../../utils/normalize-base-url';
import { coerceRemoteId } from '../remote-id';
import { hrefId, parseOpenProjectDuration, formatOpenProjectDuration } from './utils';

/** Fixed upper bound on title-search results, regardless of what the backend returns. */
export const OPENPROJECT_TITLE_SEARCH_MAX_RESULTS = 25;

/** Fixed upper bound on time-log pages fetched per `fetchTimeLogs` call. */
export const OPENPROJECT_TIME_LOGS_MAX_PAGES = 50;

/**
 * Builds the OpenProject Basic-auth token: username `apikey`, password the
 * secret, per OpenProject's REST API v3 convention.
 */
function encodeBasicAuth(secret: string): string {
  if (globalThis.btoa) {
    return globalThis.btoa(`apikey:${secret}`);
  }
  return Buffer.from(`apikey:${secret}`, 'utf-8').toString('base64');
}

/** Builds the Authorization header map for one request, or `undefined` when no secret. */
function authHeaders(secret: string | null): Record<string, string> | undefined {
  if (!secret) return undefined;
  return { Authorization: `Basic ${encodeBasicAuth(secret)}` };
}

export interface OpenProjectTimeLogEntry {
  remoteLogId: string;
  remoteIssueId: string;
  spentOn: string;
  durationSeconds: number;
  activityId: string | null;
  activityName: string | null;
  comment: string | null;
  remoteUserId: string | null;
}

export interface OpenProjectTimeLogsPageResult {
  status: number;
  logs: OpenProjectTimeLogEntry[];
  nextPageUrl: string | null;
}

interface OpenProjectHalLink {
  href?: string;
  title?: string;
}

interface OpenProjectWorkPackageElement {
  id?: string | number;
  subject?: string;
  _links?: {
    project?: OpenProjectHalLink;
  };
}

interface OpenProjectCollectionPayload {
  _embedded?: { elements?: OpenProjectWorkPackageElement[] };
}

interface OpenProjectSchemaAllowedValue {
  id?: string | number;
  name?: string;
}

interface OpenProjectSchemaFieldPayload {
  _embedded?: { allowedValues?: OpenProjectSchemaAllowedValue[] };
}

interface OpenProjectTimeEntrySchemaPayload {
  activity?: OpenProjectSchemaFieldPayload;
}

interface OpenProjectTimeEntryFormPayload {
  _embedded?: { schema?: OpenProjectTimeEntrySchemaPayload };
}

interface OpenProjectTimeEntryElement {
  id?: string | number;
  spentOn?: string;
  hours?: string;
  comment?: { raw?: string } | string;
  _links?: {
    /** Current OpenProject link for the logged entity (work package or meeting). */
    entity?: OpenProjectHalLink;
    /** Deprecated alias retained for older OpenProject responses. */
    workPackage?: OpenProjectHalLink;
    activity?: OpenProjectHalLink;
    user?: OpenProjectHalLink;
    self?: OpenProjectHalLink;
  };
}

interface OpenProjectTimeEntryCollection {
  _embedded?: { elements?: OpenProjectTimeEntryElement[] };
  _links?: { next?: OpenProjectHalLink };
}

interface OpenProjectAccountPayload {
  id?: string | number;
  name?: string;
}

const openProjectCollectionPayloadSchema = z.custom<OpenProjectCollectionPayload>(
  (value) => value instanceof Object && !Array.isArray(value),
);
const openProjectWorkPackageElementSchema = z.custom<OpenProjectWorkPackageElement>(
  (value) => value instanceof Object && !Array.isArray(value),
);
const openProjectTimeEntryFormPayloadSchema = z.custom<OpenProjectTimeEntryFormPayload>(
  (value) => value instanceof Object && !Array.isArray(value),
);
const openProjectAccountPayloadSchema = z.custom<OpenProjectAccountPayload>(
  (value) => value instanceof Object && !Array.isArray(value),
);
const openProjectTimeEntryCollectionSchema = z.custom<OpenProjectTimeEntryCollection>(
  (value) => value instanceof Object && !Array.isArray(value),
);
const openProjectTimeEntryElementSchema = z.custom<OpenProjectTimeEntryElement>(
  (value) => value instanceof Object && !Array.isArray(value),
);

export interface OpenProjectFetchTimeLogsPageInput {
  /** Local calendar day `YYYY-MM-DD`. */
  spentOn: string;
  /** Linked work-package ids to include. */
  workPackageIds: string[];
  /** When set, restricts results to this remote user id (current account). */
  userId?: string;
  /** Absolute next-page URL from a previous collection response. */
  nextPageUrl?: string;
  pageSize?: number;
}

export interface OpenProjectCreateTimeEntryInput {
  remoteIssueId: string;
  /** Local calendar day `YYYY-MM-DD`. */
  spentOn: string;
  /** Exact export duration in whole seconds. */
  durationSeconds: number;
  activityId: string;
  comment?: string;
}

/**
 * L3: one method roughly equal to one OpenProject REST v3 endpoint. Folds in
 * the request-building/response-parsing logic previously duplicated across
 * `direct`/`proxied` composables and the server proxy, and builds Basic auth
 * headers (`apikey:<secret>`) in exactly one place. Speaks HTTP status +
 * OpenProject-shaped payloads; quirk interpretation lives in
 * `OpenProjectAdapter`, one layer up.
 */
export class OpenProjectClient {
  constructor(
    private readonly transport: Transport,
    private readonly baseUrl: string,
  ) {}

  async searchByTitle(
    title: string,
    secret: string | null,
  ): Promise<{ status: number; results: RemoteIssueSearchResult[] }> {
    const filters = JSON.stringify([{ subject: { operator: '~', values: [title] } }]);
    const params = new URLSearchParams({
      filters,
      pageSize: String(OPENPROJECT_TITLE_SEARCH_MAX_RESULTS),
    });
    const { status, payload } = await this.transport.execute(
      {
        url: `${this.base()}/api/v3/work_packages?${params.toString()}`,
        method: 'GET',
        headers: authHeaders(secret),
      },
      openProjectCollectionPayloadSchema,
    );
    return { status, results: parseTitleSearchResults(payload) };
  }

  async getIssueById(
    remoteIssueId: string,
    secret: string | null,
  ): Promise<{ status: number; result: RemoteIssueSearchResult | null }> {
    const { status, payload } = await this.transport.execute(
      {
        url: `${this.base()}/api/v3/work_packages/${encodeURIComponent(remoteIssueId)}`,
        method: 'GET',
        headers: authHeaders(secret),
      },
      openProjectWorkPackageElementSchema,
    );
    return { status, result: parseIssueByIdResult(payload, status) };
  }

  async getActivityOptions(
    remoteIssueId: string,
    secret: string | null,
  ): Promise<{ status: number; options: RemoteFieldOption[] }> {
    const { status, payload } = await this.transport.execute(
      {
        url: `${this.base()}/api/v3/time_entries/form`,
        method: 'POST',
        headers: authHeaders(secret),
        body: {
          _links: {
            workPackage: { href: `/api/v3/work_packages/${encodeURIComponent(remoteIssueId)}` },
          },
        },
      },
      openProjectTimeEntryFormPayloadSchema,
    );
    return { status, options: parseTimeEntryActivitiesResults(payload) };
  }

  async getCurrentAccount(
    secret: string | null,
  ): Promise<{ status: number; account: RemoteAccount | null }> {
    const { status, payload } = await this.transport.execute(
      {
        url: `${this.base()}/api/v3/users/me`,
        method: 'GET',
        headers: authHeaders(secret),
      },
      openProjectAccountPayloadSchema,
    );
    return { status, account: parseCurrentAccountResult(payload) };
  }

  async fetchTimeLogsPage(
    input: OpenProjectFetchTimeLogsPageInput,
    secret: string | null,
  ): Promise<OpenProjectTimeLogsPageResult> {
    const request = input.nextPageUrl
      ? { url: input.nextPageUrl, method: 'GET' as const, headers: authHeaders(secret) }
      : {
          url: `${this.base()}/api/v3/time_entries?${this.buildTimeLogsQuery(input).toString()}`,
          method: 'GET' as const,
          headers: authHeaders(secret),
        };
    const { status, payload } = await this.transport.execute(
      request,
      openProjectTimeEntryCollectionSchema,
    );
    const parsed = parseTimeLogsPage(payload);
    return { status, logs: parsed.logs, nextPageUrl: parsed.nextPageUrl };
  }

  async createTimeEntry(
    input: OpenProjectCreateTimeEntryInput,
    secret: string | null,
  ): Promise<{ status: number; result: { remoteLogId: string } | null }> {
    const { status, payload } = await this.transport.execute(
      {
        url: `${this.base()}/api/v3/time_entries`,
        method: 'POST',
        headers: authHeaders(secret),
        body: input.comment
          ? {
              spentOn: input.spentOn,
              hours: formatOpenProjectDuration(input.durationSeconds),
              comment: { raw: input.comment },
              _links: {
                entity: {
                  href: `/api/v3/work_packages/${encodeURIComponent(input.remoteIssueId)}`,
                },
                activity: {
                  href: `/api/v3/time_entries/activities/${encodeURIComponent(input.activityId)}`,
                },
              },
            }
          : {
              spentOn: input.spentOn,
              hours: formatOpenProjectDuration(input.durationSeconds),
              _links: {
                entity: {
                  href: `/api/v3/work_packages/${encodeURIComponent(input.remoteIssueId)}`,
                },
                activity: {
                  href: `/api/v3/time_entries/activities/${encodeURIComponent(input.activityId)}`,
                },
              },
            },
      },
      openProjectTimeEntryElementSchema,
    );
    return { status, result: parseCreateTimeEntryResult(payload) };
  }

  private base(): string {
    return normalizeBaseUrl(this.baseUrl);
  }

  private buildTimeLogsQuery(input: OpenProjectFetchTimeLogsPageInput): URLSearchParams {
    const filters: Array<Record<string, { operator: string; values: string[] }>> = [
      { spent_on: { operator: '=d', values: [input.spentOn] } },
      // OpenProject 14+ models time entries against a polymorphic entity.
      { entity_type: { operator: '=', values: ['WorkPackage'] } },
    ];
    if (input.workPackageIds.length > 0) {
      filters.push({ entity_id: { operator: '=', values: input.workPackageIds } });
    }
    // Prefer an explicit account id; fall back to OpenProject's `me` sentinel.
    filters.push({ user_id: { operator: '=', values: [input.userId ?? 'me'] } });

    return new URLSearchParams({
      filters: JSON.stringify(filters),
      pageSize: String(input.pageSize ?? 100),
    });
  }
}

/**
 * Parses an OpenProject HAL+JSON work-packages collection response into a
 * bounded, adapter-neutral result list. Malformed/unexpected payload shapes
 * (missing `_embedded`, non-array `elements`, missing `id`/`subject`) are
 * handled by skipping the offending element rather than throwing.
 */
function parseTitleSearchResults(
  payload: OpenProjectCollectionPayload | null,
): RemoteIssueSearchResult[] {
  const elements = payload?._embedded?.elements;
  if (!elements) {
    return [];
  }

  const results: RemoteIssueSearchResult[] = [];
  for (const element of elements) {
    if (results.length >= OPENPROJECT_TITLE_SEARCH_MAX_RESULTS) {
      break;
    }
    if (element.id == null || element.subject == null) {
      continue;
    }
    results.push(toSearchResult(element));
  }

  return results;
}

/**
 * Parses an OpenProject single work-package response for an exact-ID
 * lookup. Returns `null` when `httpStatus` indicates a 404 (not found)
 * instead of throwing. Regardless of the work package's own OpenProject
 * `status` field, a resolvable payload is always returned.
 */
function parseIssueByIdResult(
  payload: OpenProjectWorkPackageElement | null,
  httpStatus: number,
): RemoteIssueSearchResult | null {
  if (httpStatus === 404) {
    return null;
  }

  const element = payload;
  if (element?.id == null || element.subject == null) {
    return null;
  }

  return toSearchResult(element);
}

function remoteProjectTitleFromWorkPackage(
  element: OpenProjectWorkPackageElement,
): string | undefined {
  const title = element._links?.project?.title;
  if (title == null) return undefined;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toSearchResult(element: OpenProjectWorkPackageElement): RemoteIssueSearchResult {
  const remoteProjectTitle = remoteProjectTitleFromWorkPackage(element);
  const result: RemoteIssueSearchResult = {
    remoteIssueId: String(element.id),
    title: String(element.subject),
  };
  if (remoteProjectTitle) result.remoteProjectTitle = remoteProjectTitle;
  return result;
}

/**
 * Parses an OpenProject project-scoped time-entry form response into the
 * `activity` field's adapter-neutral allowed-value options. Malformed/
 * unexpected shapes (missing `schema`/`activity`, missing
 * `_embedded.allowedValues`, non-array values, elements missing `id`/`name`)
 * are handled by skipping rather than throwing.
 */
function parseTimeEntryActivitiesResults(
  payload: OpenProjectTimeEntryFormPayload | null,
): RemoteFieldOption[] {
  const activity = payload?._embedded?.schema?.activity;
  const allowedValues = activity?._embedded?.allowedValues;
  if (!allowedValues) {
    return [];
  }

  const options: RemoteFieldOption[] = [];
  for (const value of allowedValues) {
    if (value.id == null || value.name == null) {
      continue;
    }
    options.push({ id: String(value.id), name: value.name });
  }

  return options;
}

/**
 * Parses `/api/v3/users/me` into an adapter-neutral account identity.
 * Returns `null` for malformed payloads.
 */
function parseCurrentAccountResult(
  payload: OpenProjectAccountPayload | null,
): RemoteAccount | null {
  const row = payload;
  if (row?.id == null || row.name == null) {
    return null;
  }
  return { id: String(row.id), name: row.name };
}

/**
 * Parses one page of OpenProject time entries into adapter-neutral logs and
 * the optional next-page URL. Malformed elements are skipped.
 */
type OpenProjectTimeLogsPage = {
  logs: OpenProjectTimeLogEntry[];
  nextPageUrl: string | null;
};

function parseTimeLogsPage(
  payload: OpenProjectTimeEntryCollection | null,
): OpenProjectTimeLogsPage {
  const collection = payload;
  const elements = collection?._embedded?.elements;
  const logs: OpenProjectTimeLogEntry[] = [];

  if (elements) {
    for (const element of elements) {
      const remoteLogId = coerceRemoteId(element.id) ?? hrefId(element._links?.self?.href);
      const remoteIssueId =
        hrefId(element._links?.entity?.href) ?? hrefId(element._links?.workPackage?.href);
      const spentOn = element.spentOn ?? null;
      const durationSeconds = parseOpenProjectDuration(element.hours);
      if (!remoteLogId || !remoteIssueId || !spentOn || durationSeconds == null) continue;

      logs.push({
        remoteLogId,
        remoteIssueId,
        spentOn,
        durationSeconds,
        activityId: hrefId(element._links?.activity?.href),
        activityName: element._links?.activity?.title ?? null,
        comment: timeEntryComment(element.comment),
        remoteUserId: hrefId(element._links?.user?.href),
      });
    }
  }

  const nextHref = collection?._links?.next?.href;
  return {
    logs,
    nextPageUrl: nextHref && nextHref.length > 0 ? nextHref : null,
  };
}

function timeEntryComment(comment: OpenProjectTimeEntryElement['comment']): string | null {
  if (comment == null) return null;
  if (comment instanceof Object) {
    return comment.raw ?? null;
  }
  return comment;
}

/**
 * Parses a create-time-entry response into the remote log id. Returns `null`
 * when the payload is malformed.
 */
function parseCreateTimeEntryResult(
  payload: OpenProjectTimeEntryElement | null,
): { remoteLogId: string } | null {
  const row = payload;
  if (!row) return null;
  const fromId = coerceRemoteId(row.id);
  if (fromId) return { remoteLogId: fromId };
  const fromSelf = hrefId(row._links?.self?.href);
  return fromSelf ? { remoteLogId: fromSelf } : null;
}
