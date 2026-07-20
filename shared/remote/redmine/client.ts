import type { RemoteFieldOption } from '../../types/remote-field-option';
import type { RemoteAccount } from '../../types/remote-account';
import type { RemoteIssueSearchResult } from '../../types/remote-issue-ref';
import type { Transport } from '../../types/remote-adapter';
import { normalizeBaseUrl } from '../../utils/normalize-base-url';
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
        time_entry: {
          issue_id: Number(input.remoteIssueId) || input.remoteIssueId,
          spent_on: input.spentOn,
          hours: secondsToRedmineHours(input.durationSeconds),
          activity_id: Number(input.activityId) || input.activityId,
          comments: input.comment,
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
  id?: unknown;
  subject?: unknown;
}

interface RedmineIssuesPayload {
  issues?: unknown;
}

interface RedmineIssuePayload {
  issue?: RedmineIssueElement;
}

interface RedmineActivityElement {
  id?: unknown;
  name?: unknown;
  active?: unknown;
}

interface RedmineActivitiesPayload {
  time_entry_activities?: unknown;
}

interface RedmineUserElement {
  id?: unknown;
  firstname?: unknown;
  lastname?: unknown;
  login?: unknown;
}

interface RedmineUserPayload {
  user?: RedmineUserElement;
}

interface RedmineTimeEntryElement {
  id?: unknown;
  spent_on?: unknown;
  hours?: unknown;
  comments?: unknown;
  issue?: { id?: unknown };
  activity?: { id?: unknown; name?: unknown };
  user?: { id?: unknown };
}

interface RedmineTimeEntriesPayload {
  time_entries?: unknown;
  total_count?: unknown;
  offset?: unknown;
  limit?: unknown;
}

interface RedmineCreateTimeEntryPayload {
  time_entry?: { id?: unknown };
}

/**
 * Parses a Redmine issues collection into a bounded, adapter-neutral result
 * list. Malformed elements are skipped rather than throwing.
 */
function parseTitleSearchResults(payload: unknown): RemoteIssueSearchResult[] {
  const issues = (payload as RedmineIssuesPayload | undefined)?.issues;
  if (!Array.isArray(issues)) {
    return [];
  }

  const results: RemoteIssueSearchResult[] = [];
  for (const element of issues as RedmineIssueElement[]) {
    if (results.length >= REDMINE_TITLE_SEARCH_MAX_RESULTS) {
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
 * Parses a single Redmine issue response. Returns `null` on 404 or when the
 * payload shape is unusable.
 */
function parseIssueByIdResult(
  payload: unknown,
  httpStatus: number,
): RemoteIssueSearchResult | null {
  if (httpStatus === 404) {
    return null;
  }

  const issue = (payload as RedmineIssuePayload | undefined)?.issue;
  if (issue == null || typeof issue !== 'object') {
    return null;
  }
  if (
    (typeof issue.id !== 'string' && typeof issue.id !== 'number') ||
    typeof issue.subject !== 'string'
  ) {
    return null;
  }

  return { remoteIssueId: String(issue.id), title: issue.subject };
}

/**
 * Parses the global time-entry activities enumeration. Inactive or malformed
 * entries are skipped.
 */
function parseActivityOptions(payload: unknown): RemoteFieldOption[] {
  const activities = (payload as RedmineActivitiesPayload | undefined)?.time_entry_activities;
  if (!Array.isArray(activities)) {
    return [];
  }

  const options: RemoteFieldOption[] = [];
  for (const value of activities as RedmineActivityElement[]) {
    if (
      value == null ||
      typeof value !== 'object' ||
      (typeof value.id !== 'string' && typeof value.id !== 'number') ||
      typeof value.name !== 'string'
    ) {
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
function parseCurrentAccountResult(payload: unknown): RemoteAccount | null {
  const user = (payload as RedmineUserPayload | undefined)?.user;
  if (user == null || typeof user !== 'object') {
    return null;
  }
  if (typeof user.id !== 'string' && typeof user.id !== 'number') {
    return null;
  }

  const first = typeof user.firstname === 'string' ? user.firstname.trim() : '';
  const last = typeof user.lastname === 'string' ? user.lastname.trim() : '';
  const composed = `${first} ${last}`.trim();
  const login = typeof user.login === 'string' ? user.login : '';
  const name = composed || login;
  if (!name) {
    return null;
  }

  return { id: String(user.id), name };
}

/**
 * Parses one page of Redmine time entries into adapter-neutral logs and the
 * reported total count. Malformed elements are skipped.
 */
function parseTimeLogsPage(payload: unknown): {
  logs: RedmineTimeLogEntry[];
  totalCount: number;
} {
  const collection = payload as RedmineTimeEntriesPayload | undefined;
  const elements = collection?.time_entries;
  const logs: RedmineTimeLogEntry[] = [];

  if (Array.isArray(elements)) {
    for (const element of elements as RedmineTimeEntryElement[]) {
      if (element == null || typeof element !== 'object') continue;

      const remoteLogId =
        typeof element.id === 'string' || typeof element.id === 'number'
          ? String(element.id)
          : null;
      const issueId = element.issue?.id;
      const remoteIssueId =
        typeof issueId === 'string' || typeof issueId === 'number' ? String(issueId) : null;
      const spentOn = typeof element.spent_on === 'string' ? element.spent_on : null;
      const hours =
        typeof element.hours === 'number'
          ? element.hours
          : typeof element.hours === 'string'
            ? Number(element.hours)
            : NaN;
      if (!remoteLogId || !remoteIssueId || !spentOn || !Number.isFinite(hours)) {
        continue;
      }

      const activityIdRaw = element.activity?.id;
      const activityId =
        typeof activityIdRaw === 'string' || typeof activityIdRaw === 'number'
          ? String(activityIdRaw)
          : null;
      const activityName =
        typeof element.activity?.name === 'string' ? element.activity.name : null;
      const comment = typeof element.comments === 'string' ? element.comments : null;
      const userIdRaw = element.user?.id;
      const remoteUserId =
        typeof userIdRaw === 'string' || typeof userIdRaw === 'number' ? String(userIdRaw) : null;

      logs.push({
        remoteLogId,
        remoteIssueId,
        spentOn,
        durationSeconds: redmineHoursToSeconds(hours),
        activityId,
        activityName,
        comment,
        remoteUserId,
      });
    }
  }

  const totalCount =
    typeof collection?.total_count === 'number' && Number.isFinite(collection.total_count)
      ? collection.total_count
      : logs.length;

  return { logs, totalCount };
}

/**
 * Parses a create-time-entry response into the remote log id. Returns `null`
 * when the payload is malformed.
 */
function parseCreateTimeEntryResult(payload: unknown): { remoteLogId: string } | null {
  const entry = (payload as RedmineCreateTimeEntryPayload | undefined)?.time_entry;
  if (entry == null || typeof entry !== 'object') return null;
  if (typeof entry.id === 'string' || typeof entry.id === 'number') {
    return { remoteLogId: String(entry.id) };
  }
  return null;
}
