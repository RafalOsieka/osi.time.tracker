import type { JsonValue } from '../../types/json';
import type { RemoteFieldOption } from '../../types/remote-field-option';
import type { RemoteAccount } from '../../types/remote-account';
import type { RemoteIssueSearchResult } from '../../types/remote-issue-ref';
import type { Transport } from '../../types/remote-adapter';
import { normalizeBaseUrl } from '../../utils/normalize-base-url';
import { coerceRemoteId } from '../remote-id';
import { redmineAuthHeaders, redmineHoursToSeconds, secondsToRedmineHours } from './utils';

/** Fixed upper bound on title-search results, regardless of what the backend returns. */
export const REDMINE_TITLE_SEARCH_MAX_RESULTS = 25;

/** Fixed upper bound on time-log pages fetched per multi-page fetch. */
export const REDMINE_TIME_LOGS_MAX_PAGES = 50;

/** Default page size for offset/limit time-entry pagination. */
export const REDMINE_TIME_LOGS_PAGE_SIZE = 100;

export interface RedmineTimeLogEntry {
  remoteLogId: string;
  remoteIssueId: string;
  spentOn: string;
  durationSeconds: number;
  activityId: string | null;
  activityName: string | null;
  comment: string | null;
  remoteUserId: string | null;
}

export interface RedmineTimeLogsPageResult {
  status: number;
  logs: RedmineTimeLogEntry[];
  /** Next offset to request, or `null` when no further page is needed. */
  nextOffset: number | null;
  totalCount: number;
}

export interface RedmineFetchTimeLogsPageInput {
  /** Local calendar day `YYYY-MM-DD`. */
  spentOn: string;
  /** Linked issue ids to include. */
  issueIds: string[];
  /** When set, restricts results to this remote user id (current account). */
  userId?: string;
  offset?: number;
  limit?: number;
}

export interface RedmineCreateTimeEntryInput {
  remoteIssueId: string;
  /** Local calendar day `YYYY-MM-DD`. */
  spentOn: string;
  /** Exact export duration in whole seconds (already rounded upstream). */
  durationSeconds: number;
  activityId: string;
  comment?: string;
}

/**
 * L3: one method roughly equal to one Redmine REST endpoint. Builds the
 * `X-Redmine-API-Key` auth header in exactly one place. Speaks HTTP status +
 * Redmine-shaped payloads; quirk interpretation lives in `RedmineAdapter`.
 */
export class RedmineClient {
  constructor(
    private readonly transport: Transport,
    private readonly baseUrl: string,
  ) {}

  async searchByTitle(
    title: string,
    secret: string | null,
  ): Promise<{ status: number; results: RemoteIssueSearchResult[] }> {
    const params = new URLSearchParams({
      subject: `~${title}`,
      status_id: '*',
      limit: String(REDMINE_TITLE_SEARCH_MAX_RESULTS),
    });
    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/issues.json?${params.toString()}`,
      method: 'GET',
      headers: redmineAuthHeaders(secret),
    });
    return { status, results: parseTitleSearchResults(payload) };
  }

  async getIssueById(
    remoteIssueId: string,
    secret: string | null,
  ): Promise<{ status: number; result: RemoteIssueSearchResult | null }> {
    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/issues/${encodeURIComponent(remoteIssueId)}.json`,
      method: 'GET',
      headers: redmineAuthHeaders(secret),
    });
    return { status, result: parseIssueByIdResult(payload, status) };
  }

  async getActivityOptions(
    secret: string | null,
  ): Promise<{ status: number; options: RemoteFieldOption[] }> {
    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/enumerations/time_entry_activities.json`,
      method: 'GET',
      headers: redmineAuthHeaders(secret),
    });
    return { status, options: parseActivityOptions(payload) };
  }

  async getCurrentAccount(
    secret: string | null,
  ): Promise<{ status: number; account: RemoteAccount | null }> {
    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/users/current.json`,
      method: 'GET',
      headers: redmineAuthHeaders(secret),
    });
    return { status, account: parseCurrentAccountResult(payload) };
  }

  async fetchTimeLogsPage(
    input: RedmineFetchTimeLogsPageInput,
    secret: string | null,
  ): Promise<RedmineTimeLogsPageResult> {
    const limit = input.limit ?? REDMINE_TIME_LOGS_PAGE_SIZE;
    const offset = input.offset ?? 0;
    const params = new URLSearchParams({
      spent_on: input.spentOn,
      user_id: input.userId ?? 'me',
      limit: String(limit),
      offset: String(offset),
    });
    if (input.issueIds.length > 0) {
      params.set('issue_id', input.issueIds.join(','));
    }

    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/time_entries.json?${params.toString()}`,
      method: 'GET',
      headers: redmineAuthHeaders(secret),
    });

    const parsed = parseTimeLogsPage(payload);
    const nextOffset =
      parsed.totalCount > offset + parsed.logs.length && parsed.logs.length > 0
        ? offset + limit
        : null;

    return {
      status,
      logs: parsed.logs,
      nextOffset,
      totalCount: parsed.totalCount,
    };
  }

  async createTimeEntry(
    input: RedmineCreateTimeEntryInput,
    secret: string | null,
  ): Promise<{ status: number; result: { remoteLogId: string } | null }> {
    const { status, payload } = await this.transport.execute({
      url: `${this.base()}/time_entries.json`,
      method: 'POST',
      headers: redmineAuthHeaders(secret),
      body: {
        time_entry: input.comment
          ? {
              issue_id: Number(input.remoteIssueId) || input.remoteIssueId,
              spent_on: input.spentOn,
              hours: secondsToRedmineHours(input.durationSeconds),
              activity_id: Number(input.activityId) || input.activityId,
              comments: input.comment,
            }
          : {
              issue_id: Number(input.remoteIssueId) || input.remoteIssueId,
              spent_on: input.spentOn,
              hours: secondsToRedmineHours(input.durationSeconds),
              activity_id: Number(input.activityId) || input.activityId,
            },
      },
    });
    return { status, result: parseCreateTimeEntryResult(payload) };
  }

  private base(): string {
    return normalizeBaseUrl(this.baseUrl);
  }
}

interface RedmineIssueElement {
  id?: string | number;
  subject?: string;
  project?: { id?: string | number; name?: string };
}

interface RedmineIssuesPayload {
  issues?: RedmineIssueElement[];
}

interface RedmineIssuePayload {
  issue?: RedmineIssueElement;
}

interface RedmineActivityElement {
  id?: string | number;
  name?: string;
  active?: boolean;
}

interface RedmineActivitiesPayload {
  time_entry_activities?: RedmineActivityElement[];
}

interface RedmineUserElement {
  id?: string | number;
  firstname?: string;
  lastname?: string;
  login?: string;
}

interface RedmineUserPayload {
  user?: RedmineUserElement;
}

interface RedmineTimeEntryElement {
  id?: string | number;
  spent_on?: string;
  hours?: number | string;
  comments?: string;
  issue?: { id?: string | number };
  activity?: { id?: string | number; name?: string };
  user?: { id?: string | number };
}

interface RedmineTimeEntriesPayload {
  time_entries?: Array<RedmineTimeEntryElement | null>;
  total_count?: number;
  offset?: number;
  limit?: number;
}

interface RedmineCreateTimeEntryPayload {
  time_entry?: { id?: string | number };
}

/**
 * Parses a Redmine issues collection into a bounded, adapter-neutral result
 * list. Malformed elements are skipped rather than throwing.
 */
function parseTitleSearchResults(payload: JsonValue | null): RemoteIssueSearchResult[] {
  // SAFETY: transport JSON is untyped; Redmine search is `{ issues: Issue[] }`.
  const issues = (payload as RedmineIssuesPayload | null)?.issues;
  if (!issues) {
    return [];
  }

  const results: RemoteIssueSearchResult[] = [];
  for (const element of issues) {
    if (results.length >= REDMINE_TITLE_SEARCH_MAX_RESULTS) {
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
 * Parses a single Redmine issue response. Returns `null` on 404 or when the
 * payload shape is unusable.
 */
function parseIssueByIdResult(
  payload: JsonValue | null,
  httpStatus: number,
): RemoteIssueSearchResult | null {
  if (httpStatus === 404) {
    return null;
  }

  // SAFETY: transport JSON is untyped; exact-id lookup is `{ issue: Issue }`.
  const issue = (payload as RedmineIssuePayload | null)?.issue;
  if (issue?.id == null || issue.subject == null) {
    return null;
  }

  return toSearchResult(issue);
}

function remoteProjectTitleFromIssue(element: RedmineIssueElement): string | undefined {
  const name = element.project?.name;
  if (name == null) return undefined;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toSearchResult(element: RedmineIssueElement): RemoteIssueSearchResult {
  const remoteProjectTitle = remoteProjectTitleFromIssue(element);
  const result: RemoteIssueSearchResult = {
    remoteIssueId: String(element.id),
    title: String(element.subject),
  };
  if (remoteProjectTitle) result.remoteProjectTitle = remoteProjectTitle;
  return result;
}

/**
 * Parses the global time-entry activities enumeration. Inactive or malformed
 * entries are skipped.
 */
function parseActivityOptions(payload: JsonValue | null): RemoteFieldOption[] {
  // SAFETY: transport JSON is untyped; activities are `{ time_entry_activities: Activity[] }`.
  const activities = (payload as RedmineActivitiesPayload | null)?.time_entry_activities;
  if (!activities) {
    return [];
  }

  const options: RemoteFieldOption[] = [];
  for (const value of activities) {
    if (value.id == null || value.name == null) {
      continue;
    }
    // Prefer active activities; treat missing `active` as active for older payloads.
    if (value.active === false) {
      continue;
    }
    options.push({ id: String(value.id), name: value.name });
  }

  return options;
}

/**
 * Parses `/users/current.json` into an adapter-neutral account identity.
 * Name is composed as `firstname + ' ' + lastname` when available.
 */
function parseCurrentAccountResult(payload: JsonValue | null): RemoteAccount | null {
  // SAFETY: transport JSON is untyped; current user is `{ user: User }`.
  const user = (payload as RedmineUserPayload | null)?.user;
  if (user?.id == null) {
    return null;
  }

  const first = user.firstname?.trim() ?? '';
  const last = user.lastname?.trim() ?? '';
  const composed = `${first} ${last}`.trim();
  const name = composed || user.login || '';
  if (!name) {
    return null;
  }

  return { id: String(user.id), name };
}

/**
 * Parses one page of Redmine time entries into adapter-neutral logs and the
 * reported total count. Malformed elements are skipped.
 */
type RedmineTimeLogsPage = {
  logs: RedmineTimeLogEntry[];
  totalCount: number;
};

function parseTimeLogsPage(payload: JsonValue | null): RedmineTimeLogsPage {
  // SAFETY: transport JSON is untyped; time logs are `{ time_entries, total_count }`.
  const collection = payload as RedmineTimeEntriesPayload | null;
  const elements = collection?.time_entries;
  const logs: RedmineTimeLogEntry[] = [];

  if (elements) {
    for (const element of elements) {
      if (element == null) continue;
      const remoteLogId = coerceRemoteId(element.id);
      const remoteIssueId = coerceRemoteId(element.issue?.id);
      const spentOn = element.spent_on ?? null;
      const hours = element.hours == null ? NaN : Number(element.hours);
      if (!remoteLogId || !remoteIssueId || !spentOn || !Number.isFinite(hours)) {
        continue;
      }

      logs.push({
        remoteLogId,
        remoteIssueId,
        spentOn,
        durationSeconds: redmineHoursToSeconds(hours),
        activityId: coerceRemoteId(element.activity?.id),
        activityName: element.activity?.name ?? null,
        comment: element.comments ?? null,
        remoteUserId: coerceRemoteId(element.user?.id),
      });
    }
  }

  const totalCount =
    collection?.total_count != null && Number.isFinite(collection.total_count)
      ? collection.total_count
      : logs.length;

  return { logs, totalCount };
}

/**
 * Parses a create-time-entry response into the remote log id. Returns `null`
 * when the payload is malformed.
 */
function parseCreateTimeEntryResult(payload: JsonValue | null): { remoteLogId: string } | null {
  // SAFETY: transport JSON is untyped; create returns `{ time_entry: { id } }`.
  const entry = (payload as RedmineCreateTimeEntryPayload | null)?.time_entry;
  const id = coerceRemoteId(entry?.id);
  return id ? { remoteLogId: id } : null;
}
