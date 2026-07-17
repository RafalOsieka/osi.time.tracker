import type { RemoteIssueSearchResult } from '../types/remote-issue-ref';

/** Fixed upper bound on title-search results, regardless of what the backend returns. */
export const OPENPROJECT_TITLE_SEARCH_MAX_RESULTS = 25;

/** A pure, transport-agnostic HTTP request description. */
export interface AdapterRequest {
  url: string;
  method: 'GET';
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
 * Builds the OpenProject global time-entries schema request, used to fetch
 * the `activity` field's allowed values (required-field options).
 */
export function buildTimeEntryActivitiesRequest(baseUrl: string): AdapterRequest {
  return {
    url: `${normalizeBaseUrl(baseUrl)}/api/v3/time_entries/schema`,
    method: 'GET',
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

/**
 * Parses an OpenProject time-entries schema response into the `activity`
 * field's adapter-neutral allowed-value options. Malformed/unexpected
 * shapes (missing `activity`, missing `_embedded.allowedValues`,
 * non-array values, elements missing `id`/`name`) are handled by skipping
 * rather than throwing.
 */
export function parseTimeEntryActivitiesResults(payload: unknown): AdapterFieldOption[] {
  const activity = (payload as OpenProjectTimeEntrySchemaPayload | undefined)?.activity;
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
