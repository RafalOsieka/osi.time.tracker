import type {
  RemoteAccount,
  RemoteFieldOption,
  RemoteIssueSearchResult,
  RemoteProjectDto,
  RemoteTimeLogDto,
  RemoteTrackerAdapter,
} from '@osi/remote-trackers/contracts';
import type {
  CreateTimeEntryInput,
  CreateTimeEntryResult,
  DeleteTimeEntryInput,
  DeleteTimeEntryResult,
  FetchTimeLogsInRangeInput,
  FetchTimeLogsInRangeResult,
  FetchTimeLogsInput,
  FetchTimeLogsResult,
  GetActivityOptionsInput,
  GetActivityOptionsResult,
  GetIssueByIdInput,
  GetIssueByIdResult,
  ListProjectsResult,
  SearchIssuesInput,
  SearchIssuesResult,
} from './operations.js';

type Extends<A, B> = A extends B ? true : false;
type Mutual<A, B> = Extends<A, B> extends true ? Extends<B, A> : false;

// `searchIssues`/`getIssueById` take two positional in-process arguments
// (query/id, optional scope) but cross the wire as one object per operation
// (matching every other multi-field operation), so each position is checked
// against its matching input field rather than the whole input at once.
type SearchIssuesAgreed =
  Mutual<
    SearchIssuesInput['query'],
    Parameters<RemoteTrackerAdapter['searchIssues']>[0]
  > extends true
    ? Mutual<
        SearchIssuesInput['scope'],
        Parameters<RemoteTrackerAdapter['searchIssues']>[1]
      > extends true
      ? Mutual<SearchIssuesResult, Awaited<ReturnType<RemoteTrackerAdapter['searchIssues']>>>
      : false
    : false;

type GetIssueByIdAgreed =
  Mutual<
    GetIssueByIdInput['remoteIssueId'],
    Parameters<RemoteTrackerAdapter['getIssueById']>[0]
  > extends true
    ? Mutual<
        GetIssueByIdInput['scope'],
        Parameters<RemoteTrackerAdapter['getIssueById']>[1]
      > extends true
      ? Mutual<GetIssueByIdResult, Awaited<ReturnType<RemoteTrackerAdapter['getIssueById']>>>
      : false
    : false;

type ListProjectsAgreed = Mutual<
  ListProjectsResult,
  Awaited<ReturnType<RemoteTrackerAdapter['listProjects']>>
>;

type GetActivityOptionsAgreed =
  Mutual<
    GetActivityOptionsInput,
    Parameters<RemoteTrackerAdapter['getActivityOptions']>[0]
  > extends true
    ? Mutual<
        GetActivityOptionsResult,
        Awaited<ReturnType<RemoteTrackerAdapter['getActivityOptions']>>
      >
    : false;

type GetCurrentAccountAgreed = Mutual<
  RemoteAccount,
  Awaited<ReturnType<RemoteTrackerAdapter['getCurrentAccount']>>
>;

type FetchTimeLogsAgreed =
  Mutual<FetchTimeLogsInput, Parameters<RemoteTrackerAdapter['fetchTimeLogs']>[0]> extends true
    ? Mutual<FetchTimeLogsResult, Awaited<ReturnType<RemoteTrackerAdapter['fetchTimeLogs']>>>
    : false;

type FetchTimeLogsInRangeAgreed =
  Mutual<
    FetchTimeLogsInRangeInput,
    Parameters<RemoteTrackerAdapter['fetchTimeLogsInRange']>[0]
  > extends true
    ? Mutual<
        FetchTimeLogsInRangeResult,
        Awaited<ReturnType<RemoteTrackerAdapter['fetchTimeLogsInRange']>>
      >
    : false;

type CreateTimeEntryAgreed =
  Mutual<CreateTimeEntryInput, Parameters<RemoteTrackerAdapter['createTimeEntry']>[0]> extends true
    ? Mutual<CreateTimeEntryResult, Awaited<ReturnType<RemoteTrackerAdapter['createTimeEntry']>>>
    : false;

type DeleteTimeEntryAgreed =
  Mutual<DeleteTimeEntryInput, Parameters<RemoteTrackerAdapter['deleteTimeEntry']>[0]> extends true
    ? Mutual<DeleteTimeEntryResult, Awaited<ReturnType<RemoteTrackerAdapter['deleteTimeEntry']>>>
    : false;

type ResultContractsAgreed =
  Mutual<RemoteIssueSearchResult, SearchIssuesResult[number]> extends true
    ? Mutual<RemoteFieldOption, GetActivityOptionsResult[number]> extends true
      ? Mutual<RemoteTimeLogDto, FetchTimeLogsResult[number]> extends true
        ? Mutual<RemoteProjectDto, ListProjectsResult[number]>
        : false
      : false
    : false;

export type ProtocolMatchesRemoteTrackerAdapter = SearchIssuesAgreed extends true
  ? GetIssueByIdAgreed extends true
    ? ListProjectsAgreed extends true
      ? GetActivityOptionsAgreed extends true
        ? GetCurrentAccountAgreed extends true
          ? FetchTimeLogsAgreed extends true
            ? FetchTimeLogsInRangeAgreed extends true
              ? CreateTimeEntryAgreed extends true
                ? DeleteTimeEntryAgreed extends true
                  ? ResultContractsAgreed
                  : false
                : false
              : false
            : false
          : false
        : false
      : false
    : false
  : false;

export const protocolMatchesRemoteTrackerAdapter: ProtocolMatchesRemoteTrackerAdapter = true;
