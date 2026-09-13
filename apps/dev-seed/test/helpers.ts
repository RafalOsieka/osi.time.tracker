import type {
  JsonValue,
  RemoteFieldOption,
  RemoteTimeEntryDeleteOutcome,
  RemoteTimeLogDto,
  RemoteTrackerAdapter,
} from '@osi/remote-trackers/contracts';
import type { JsonHttp, JsonMethod } from '../src/http.js';

export interface RecordedRequest {
  method: JsonMethod;
  url: string;
  body: JsonValue | undefined;
}

/** Route result meaning "respond 404" (a deleted project, for example). */
export const NOT_FOUND = Symbol('not-found');

type RouteResult = JsonValue | typeof NOT_FOUND;

/** Canned responses keyed by `METHOD url` (query string included); unknown routes 404. */
export function fakeJsonHttp(
  routes: Record<string, RouteResult | ((body: JsonValue | undefined) => RouteResult)>,
  recorded: RecordedRequest[] = [],
): JsonHttp {
  return {
    async request(method, url, schema, body) {
      recorded.push({ method, url, body });
      const route = routes[`${method} ${url}`];
      if (route === undefined) return { status: 404, payload: null };
      const value = route instanceof Function ? route(body) : route;
      if (value === NOT_FOUND) return { status: 404, payload: null };
      const parsed = schema.safeParse(value);
      return { status: 200, payload: parsed.success ? parsed.data : null };
    },
  };
}

export interface FakeAdapterState {
  activities: RemoteFieldOption[];
  logs: RemoteTimeLogDto[];
  created: Parameters<RemoteTrackerAdapter['createTimeEntry']>[0][];
  deleted: string[];
  deleteOutcome: RemoteTimeEntryDeleteOutcome;
  /** When set, `createTimeEntry` rejects with this error. */
  createFailure: Error | null;
}

export function fakeAdapterState(overrides: Partial<FakeAdapterState> = {}): FakeAdapterState {
  return {
    activities: [
      { id: '9', name: 'Development' },
      { id: '8', name: 'Design' },
    ],
    logs: [],
    created: [],
    deleted: [],
    deleteOutcome: { status: 'deleted' },
    createFailure: null,
    ...overrides,
  };
}

const notUsed = () => Promise.reject(new Error('not used by the seed'));

/** A `RemoteTrackerAdapter` that records time-log operations and serves canned reads. */
export function fakeAdapter(state: FakeAdapterState): RemoteTrackerAdapter {
  return {
    searchIssues: notUsed,
    getIssueById: notUsed,
    listProjects: notUsed,
    getCurrentAccount: async () => ({ id: '1', name: 'admin' }),
    getActivityOptions: async () => state.activities,
    fetchTimeLogs: notUsed,
    fetchTimeLogsInRange: async () => state.logs,
    createTimeEntry: async (input) => {
      if (state.createFailure) throw state.createFailure;
      state.created.push(input);
      return { remoteLogId: `t${state.created.length}` };
    },
    deleteTimeEntry: async (remoteLogId) => {
      state.deleted.push(remoteLogId);
      return state.deleteOutcome;
    },
  };
}
