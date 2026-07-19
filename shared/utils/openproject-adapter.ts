import type { RemoteIssueSearchResult } from '../types/remote-issue-ref';

/** Fixed upper bound on title-search results, regardless of what the backend returns. */
export const OPENPROJECT_TITLE_SEARCH_MAX_RESULTS = 25;

/** A pure, transport-agnostic HTTP request description. */
export interface AdapterRequest {
  url: string;
  method: 'GET' | 'POST';
  /** JSON body for `POST`/form endpoints; unused by `GET` requests. */
  body?: unknown;
}

/**
 * Removes any trailing slash(es) so URL joining never produces a double
 * slash, regardless of how the configured base URL was entered.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/**
 * Builds the OpenProject work-packages request for a bounded title-phrase
 * filter search. Uses the `filters` query parameter (JSON-encoded array)
 * with a `~` (contains) operator on `subject`, and does not restrict by
 * status. `pageSize` is capped at `OPENPROJECT_TITLE_SEARCH_MAX_RESULTS`.
 */
export function buildTitleSearchRequest(baseUrl: string, title: string): AdapterRequest {
  const filters = JSON.stringify([{ subject: { operator: '~', values: [title] } }]);
  const params = new URLSearchParams({
    filters,
    pageSize: String(OPENPROJECT_TITLE_SEARCH_MAX_RESULTS),
  });
  return {
    url: `${normalizeBaseUrl(baseUrl)}/api/v3/work_packages?${params.toString()}`,
    method: 'GET',
  };
}

/**
 * Builds the OpenProject work-package request for an exact-ID lookup.
 */
export function buildIssueByIdRequest(baseUrl: string, remoteIssueId: string): AdapterRequest {
  return {
    url: `${normalizeBaseUrl(baseUrl)}/api/v3/work_packages/${encodeURIComponent(remoteIssueId)}`,
    method: 'GET',
  };
}

/**
 * Derives a usable issue URL from a normalized base URL and remote issue id.
 */
export function deriveIssueUrl(baseUrl: string, remoteIssueId: string): string {
  return `${normalizeBaseUrl(baseUrl)}/work_packages/${encodeURIComponent(remoteIssueId)}`;
}

interface OpenProjectWorkPackageElement {
  id?: unknown;
  subject?: unknown;
}

interface OpenProjectCollectionPayload {
  _embedded?: {
    elements?: unknown;
  };
}

/**
 * Parses an OpenProject HAL+JSON work-packages collection response into a
 * bounded, adapter-neutral result list. Malformed/unexpected payload shapes
 * (missing `_embedded`, non-array `elements`, missing `id`/`subject`) are
 * handled by skipping the offending element rather than throwing.
 */
export function parseTitleSearchResults(payload: unknown): RemoteIssueSearchResult[] {
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
 * lookup. Returns `null` when `status` indicates a 404 (not found) instead
 * of throwing. Regardless of the work package's own OpenProject `status`
 * field, a resolvable payload is always returned.
 */
export function parseIssueByIdResult(
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

/** An adapter-neutral `{ id, name }` option, e.g. a selectable OpenProject activity. */
export interface AdapterFieldOption {
  id: string;
  name: string;
}

/**
 * Builds the OpenProject project-scoped time-entry form request, used to
 * fetch the `activity` field's allowed values (required-field options) for
 * the project that owns `remoteIssueId`'s work package. OpenProject derives
 * the project itself from the linked work package, so no separate
 * work-package-to-project lookup is needed.
 */
export function buildTimeEntryActivitiesRequest(
  baseUrl: string,
  remoteIssueId: string,
): AdapterRequest {
  return {
    url: `${normalizeBaseUrl(baseUrl)}/api/v3/time_entries/form`,
    method: 'POST',
    body: {
      _links: {
        workPackage: { href: `/api/v3/work_packages/${encodeURIComponent(remoteIssueId)}` },
      },
    },
  };
}

interface OpenProjectSchemaAllowedValue {
  id?: unknown;
  name?: unknown;
}

interface OpenProjectSchemaFieldPayload {
  _embedded?: {
    allowedValues?: unknown;
  };
}

interface OpenProjectTimeEntrySchemaPayload {
  activity?: OpenProjectSchemaFieldPayload;
}

interface OpenProjectTimeEntryFormPayload {
  _embedded?: {
    schema?: OpenProjectTimeEntrySchemaPayload;
  };
}

/**
 * Parses an OpenProject project-scoped time-entry form response into the
 * `activity` field's adapter-neutral allowed-value options. Malformed/
 * unexpected shapes (missing `schema`/`activity`, missing
 * `_embedded.allowedValues`, non-array values, elements missing `id`/`name`)
 * are handled by skipping rather than throwing.
 */
export function parseTimeEntryActivitiesResults(payload: unknown): AdapterFieldOption[] {
  const activity = (payload as OpenProjectTimeEntryFormPayload | undefined)?._embedded?.schema
    ?.activity;
  const allowedValues = activity?._embedded?.allowedValues;
  if (!Array.isArray(allowedValues)) {
    return [];
  }

  const options: AdapterFieldOption[] = [];
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

/** Current authenticated OpenProject account identity. */
export interface OpenProjectAccount {
  id: string;
  name: string;
}

/**
 * Builds the OpenProject request that resolves the authenticated remote account
 * (`GET /api/v3/users/me`).
 */
export function buildCurrentAccountRequest(baseUrl: string): AdapterRequest {
  return {
    url: `${normalizeBaseUrl(baseUrl)}/api/v3/users/me`,
    method: 'GET',
  };
}

/**
 * Parses `/api/v3/users/me` into an adapter-neutral account identity.
 * Returns `null` for malformed payloads.
 */
export function parseCurrentAccountResult(payload: unknown): OpenProjectAccount | null {
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
 * Serializes whole seconds to an OpenProject ISO-8601 duration (`PT…H…M…S`).
 * Zero and negative inputs yield `PT0S`.
 */
export function formatOpenProjectDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  let out = 'PT';
  if (hours > 0) out += `${hours}H`;
  if (minutes > 0) out += `${minutes}M`;
  if (secs > 0 || (hours === 0 && minutes === 0)) out += `${secs}S`;
  return out;
}

/**
 * Parses an OpenProject ISO-8601 duration (`PT1H30M`, `PT45M`, `PT90S`, …)
 * into whole seconds. Returns `null` when the value cannot be parsed.
 */
export function parseOpenProjectDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (![hours, minutes, seconds].every((n) => Number.isFinite(n))) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export interface BuildTimeLogsRequestInput {
  baseUrl: string;
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

/**
 * Builds a filtered, paginated OpenProject time-entries collection request for
 * the given spent-on date and work packages. Prefer `nextPageUrl` when following
 * pagination so upstream offsets stay authoritative.
 */
export function buildTimeLogsRequest(input: BuildTimeLogsRequestInput): AdapterRequest {
  if (input.nextPageUrl) {
    return { url: input.nextPageUrl, method: 'GET' };
  }

  const filters: Array<Record<string, { operator: string; values: string[] }>> = [
    { spent_on: { operator: '=d', values: [input.spentOn] } },
    // OpenProject 14+ models time entries against a polymorphic entity.
    { entity_type: { operator: '=', values: ['WorkPackage'] } },
  ];
  if (input.workPackageIds.length > 0) {
    filters.push({
      entity_id: { operator: '=', values: input.workPackageIds },
    });
  }
  // Prefer an explicit account id; fall back to OpenProject's `me` sentinel.
  filters.push({
    user_id: { operator: '=', values: [input.userId ?? 'me'] },
  });

  const params = new URLSearchParams({
    filters: JSON.stringify(filters),
    pageSize: String(input.pageSize ?? 100),
  });

  return {
    url: `${normalizeBaseUrl(input.baseUrl)}/api/v3/time_entries?${params.toString()}`,
    method: 'GET',
  };
}

export interface ParsedTimeLogPage {
  logs: Array<{
    remoteLogId: string;
    remoteIssueId: string;
    spentOn: string;
    durationSeconds: number;
    activityId: string | null;
    activityName: string | null;
    comment: string | null;
    remoteUserId: string | null;
  }>;
  /** Absolute URL of the next page, when present. */
  nextPageUrl: string | null;
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

function hrefId(href: unknown): string | null {
  if (typeof href !== 'string') return null;
  const match = /\/(\d+)(?:\?.*)?$/.exec(href);
  return match?.[1] ?? null;
}

/**
 * Parses one page of OpenProject time entries into adapter-neutral logs and
 * the optional next-page URL. Malformed elements are skipped.
 */
export function parseTimeLogsPage(payload: unknown): ParsedTimeLogPage {
  const collection = payload as OpenProjectTimeEntryCollection | undefined;
  const elements = collection?._embedded?.elements;
  const logs: ParsedTimeLogPage['logs'] = [];

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

export interface BuildCreateTimeEntryInput {
  baseUrl: string;
  remoteIssueId: string;
  /** Local calendar day `YYYY-MM-DD`. */
  spentOn: string;
  /** Exact export duration in whole seconds. */
  durationSeconds: number;
  activityId: string;
  comment?: string;
}

/**
 * Builds the OpenProject create-time-entry request for one exported task.
 */
export function buildCreateTimeEntryRequest(input: BuildCreateTimeEntryInput): AdapterRequest {
  return {
    url: `${normalizeBaseUrl(input.baseUrl)}/api/v3/time_entries`,
    method: 'POST',
    body: {
      spentOn: input.spentOn,
      hours: formatOpenProjectDuration(input.durationSeconds),
      comment: input.comment ? { raw: input.comment } : undefined,
      _links: {
        // OpenProject 14+ accepts the polymorphic `entity` link (work package).
        entity: {
          href: `/api/v3/work_packages/${encodeURIComponent(input.remoteIssueId)}`,
        },
        activity: {
          href: `/api/v3/time_entries/activities/${encodeURIComponent(input.activityId)}`,
        },
      },
    },
  };
}

/**
 * Parses a create-time-entry response into the remote log id. Returns `null`
 * when the payload is malformed.
 */
export function parseCreateTimeEntryResult(payload: unknown): { remoteLogId: string } | null {
  if (payload == null || typeof payload !== 'object') return null;
  const row = payload as OpenProjectTimeEntryElement;
  if (typeof row.id === 'string' || typeof row.id === 'number') {
    return { remoteLogId: String(row.id) };
  }
  const fromSelf = hrefId(row._links?.self?.href);
  return fromSelf ? { remoteLogId: fromSelf } : null;
}
