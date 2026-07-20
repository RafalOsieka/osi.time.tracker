import type { RemoteFieldOption } from '../../types/remote-field-option';
import type { RemoteAccount } from '../../types/remote-account';
import type { RemoteIssueSearchResult } from '../../types/remote-issue-ref';
import type { Transport } from '../../types/remote-adapter';
import {
  hrefId,
  normalizeBaseUrl,
  parseOpenProjectDuration,
  formatOpenProjectDuration,
} from './utils';

/** Fixed upper bound on title-search results, regardless of what the backend returns. */
export const OPENPROJECT_TITLE_SEARCH_MAX_RESULTS = 25;

/** Fixed upper bound on time-log pages fetched per `fetchTimeLogs` call. */
export const OPENPROJECT_TIME_LOGS_MAX_PAGES = 50;

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

interface OpenProjectWorkPackageElement {
  id?: unknown;
  subject?: unknown;
}

interface OpenProjectCollectionPayload {
  _embedded?: { elements?: unknown };
}

interface OpenProjectSchemaAllowedValue {
  id?: unknown;
  name?: unknown;
}

interface OpenProjectSchemaFieldPayload {
  _embedded?: { allowedValues?: unknown };
}

interface OpenProjectTimeEntrySchemaPayload {
  activity?: OpenProjectSchemaFieldPayload;
}

interface OpenProjectTimeEntryFormPayload {
  _embedded?: { schema?: OpenProjectTimeEntrySchemaPayload };
}

interface OpenProjectHalLink {
  href?: unknown;
  title?: unknown;
}

interface OpenProjectTimeEntryElement {
  id?: unknown;
  spentOn?: unknown;
  hours?: unknown;
  comment?: { raw?: unknown } | unknown;
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
  _embedded?: { elements?: unknown };
  _links?: { next?: OpenProjectHalLink };
}

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
 * `direct`/`proxied` composables and the server proxy, and applies Basic
 * auth (`apikey:<secret>`) in exactly one place. Speaks HTTP status +
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
    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/api/v3/work_packages?${params.toString()}`,
      method: 'GET',
      secret,
    });
    return { status, results: parseTitleSearchResults(payload) };
  }

  async getIssueById(
    remoteIssueId: string,
    secret: string | null,
  ): Promise<{ status: number; result: RemoteIssueSearchResult | null }> {
    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/api/v3/work_packages/${encodeURIComponent(remoteIssueId)}`,
      method: 'GET',
      secret,
    });
    return { status, result: parseIssueByIdResult(payload, status) };
  }

  async getActivityOptions(
    remoteIssueId: string,
    secret: string | null,
  ): Promise<{ status: number; options: RemoteFieldOption[] }> {
    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/api/v3/time_entries/form`,
      method: 'POST',
      secret,
      body: {
        _links: {
          workPackage: { href: `/api/v3/work_packages/${encodeURIComponent(remoteIssueId)}` },
        },
      },
    });
    return { status, options: parseTimeEntryActivitiesResults(payload) };
  }

  async getCurrentAccount(
    secret: string | null,
  ): Promise<{ status: number; account: RemoteAccount | null }> {
    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/api/v3/users/me`,
      method: 'GET',
      secret,
    });
    return { status, account: parseCurrentAccountResult(payload) };
  }

  async fetchTimeLogsPage(
    input: OpenProjectFetchTimeLogsPageInput,
    secret: string | null,
  ): Promise<OpenProjectTimeLogsPageResult> {
    const request = input.nextPageUrl
      ? { url: input.nextPageUrl, method: 'GET' as const, secret }
      : {
          url: `${this.base()}/api/v3/time_entries?${this.buildTimeLogsQuery(input).toString()}`,
          method: 'GET' as const,
          secret,
        };
    const { status, payload } = await this.transport.execute(request);
    const parsed = parseTimeLogsPage(payload);
    return { status, logs: parsed.logs, nextPageUrl: parsed.nextPageUrl };
  }

  async createTimeEntry(
    input: OpenProjectCreateTimeEntryInput,
    secret: string | null,
  ): Promise<{ status: number; result: { remoteLogId: string } | null }> {
    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/api/v3/time_entries`,
      method: 'POST',
      secret,
      body: {
        spentOn: input.spentOn,
        hours: formatOpenProjectDuration(input.durationSeconds),
        comment: input.comment ? { raw: input.comment } : undefined,
        _links: {
          // OpenProject 14+ accepts the polymorphic `entity` link (work package).
          entity: { href: `/api/v3/work_packages/${encodeURIComponent(input.remoteIssueId)}` },
          activity: {
            href: `/api/v3/time_entries/activities/${encodeURIComponent(input.activityId)}`,
          },
        },
      },
    });
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
function parseTitleSearchResults(payload: unknown): RemoteIssueSearchResult[] {
  const elements = (payload as OpenProjectCollectionPayload | undefined)?._embedded?.elements;
  if (!Array.isArray(elements)) {
    return [];
  }

  const results: RemoteIssueSearchResult[] = [];
  for (const element of elements as OpenProjectWorkPackageElement[]) {
    if (results.length >= OPENPROJECT_TITLE_SEARCH_MAX_RESULTS) {
      break;
    }
    if (
      element == null ||
      typeof element !== 'object' ||
      (typeof element.id !== 'string' && typeof element.id !== 'number') ||
      typeof element.subject !== 'string'
    ) {
      continue;
    }
    results.push({ remoteIssueId: String(element.id), title: element.subject });
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
  payload: unknown,
  httpStatus: number,
): RemoteIssueSearchResult | null {
  if (httpStatus === 404) {
    return null;
  }

  if (payload == null || typeof payload !== 'object') {
    return null;
  }

  const element = payload as OpenProjectWorkPackageElement;
  if (
    (typeof element.id !== 'string' && typeof element.id !== 'number') ||
    typeof element.subject !== 'string'
  ) {
    return null;
  }

  return { remoteIssueId: String(element.id), title: element.subject };
}

/**
 * Parses an OpenProject project-scoped time-entry form response into the
 * `activity` field's adapter-neutral allowed-value options. Malformed/
 * unexpected shapes (missing `schema`/`activity`, missing
 * `_embedded.allowedValues`, non-array values, elements missing `id`/`name`)
 * are handled by skipping rather than throwing.
 */
function parseTimeEntryActivitiesResults(payload: unknown): RemoteFieldOption[] {
  const activity = (payload as OpenProjectTimeEntryFormPayload | undefined)?._embedded?.schema
    ?.activity;
  const allowedValues = activity?._embedded?.allowedValues;
  if (!Array.isArray(allowedValues)) {
    return [];
  }

  const options: RemoteFieldOption[] = [];
  for (const value of allowedValues as OpenProjectSchemaAllowedValue[]) {
    if (
      value == null ||
      typeof value !== 'object' ||
      (typeof value.id !== 'string' && typeof value.id !== 'number') ||
      typeof value.name !== 'string'
    ) {
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
function parseCurrentAccountResult(payload: unknown): RemoteAccount | null {
  if (payload == null || typeof payload !== 'object') {
    return null;
  }
  const row = payload as { id?: unknown; name?: unknown };
  if ((typeof row.id !== 'string' && typeof row.id !== 'number') || typeof row.name !== 'string') {
    return null;
  }
  return { id: String(row.id), name: row.name };
}

/**
 * Parses one page of OpenProject time entries into adapter-neutral logs and
 * the optional next-page URL. Malformed elements are skipped.
 */
function parseTimeLogsPage(payload: unknown): {
  logs: OpenProjectTimeLogEntry[];
  nextPageUrl: string | null;
} {
  const collection = payload as OpenProjectTimeEntryCollection | undefined;
  const elements = collection?._embedded?.elements;
  const logs: OpenProjectTimeLogEntry[] = [];

  if (Array.isArray(elements)) {
    for (const element of elements as OpenProjectTimeEntryElement[]) {
      if (element == null || typeof element !== 'object') continue;
      const remoteLogId =
        typeof element.id === 'string' || typeof element.id === 'number'
          ? String(element.id)
          : hrefId(element._links?.self?.href);
      // Prefer `entity` (current); fall back to deprecated `workPackage`.
      const remoteIssueId =
        hrefId(element._links?.entity?.href) ?? hrefId(element._links?.workPackage?.href);
      const spentOn = typeof element.spentOn === 'string' ? element.spentOn : null;
      const durationSeconds = parseOpenProjectDuration(element.hours);
      if (!remoteLogId || !remoteIssueId || !spentOn || durationSeconds == null) continue;

      const activityHref = element._links?.activity?.href;
      const activityId = hrefId(activityHref);
      const activityName =
        typeof element._links?.activity?.title === 'string' ? element._links.activity.title : null;
      let comment: string | null = null;
      if (
        element.comment != null &&
        typeof element.comment === 'object' &&
        typeof (element.comment as { raw?: unknown }).raw === 'string'
      ) {
        comment = (element.comment as { raw: string }).raw;
      } else if (typeof element.comment === 'string') {
        comment = element.comment;
      }

      logs.push({
        remoteLogId,
        remoteIssueId,
        spentOn,
        durationSeconds,
        activityId,
        activityName,
        comment,
        remoteUserId: hrefId(element._links?.user?.href),
      });
    }
  }

  const nextHref = collection?._links?.next?.href;
  return {
    logs,
    nextPageUrl: typeof nextHref === 'string' && nextHref.length > 0 ? nextHref : null,
  };
}

/**
 * Parses a create-time-entry response into the remote log id. Returns `null`
 * when the payload is malformed.
 */
function parseCreateTimeEntryResult(payload: unknown): { remoteLogId: string } | null {
  if (payload == null || typeof payload !== 'object') return null;
  const row = payload as OpenProjectTimeEntryElement;
  if (typeof row.id === 'string' || typeof row.id === 'number') {
    return { remoteLogId: String(row.id) };
  }
  const fromSelf = hrefId(row._links?.self?.href);
  return fromSelf ? { remoteLogId: fromSelf } : null;
}
