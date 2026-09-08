import type {
  RemoteAccount,
  RemoteFieldOption,
  RemoteIssueSearchResult,
  RemoteTimeLogDto,
  RemoteTrackerAdapter,
} from '@osi/remote-trackers/contracts';
import type {
  CreateTimeEntryInput,
  CreateTimeEntryResult,
  FetchTimeLogsInRangeInput,
  FetchTimeLogsInRangeResult,
  FetchTimeLogsInput,
  FetchTimeLogsResult,
  GetActivityOptionsInput,
  GetActivityOptionsResult,
  GetIssueByIdInput,
  GetIssueByIdResult,
  SearchIssuesInput,
  SearchIssuesResult,
} from './operations.js';

type Extends<A, B> = A extends B ? true : false;
type Mutual<A, B> = Extends<A, B> extends true ? Extends<B, A> : false;

type SearchIssuesAgreed =
  Mutual<SearchIssuesInput, Parameters<RemoteTrackerAdapter['searchIssues']>[0]> extends true
    ? Mutual<SearchIssuesResult, Awaited<ReturnType<RemoteTrackerAdapter['searchIssues']>>>
    : false;

type GetIssueByIdAgreed =
  Mutual<GetIssueByIdInput, Parameters<RemoteTrackerAdapter['getIssueById']>[0]> extends true
    ? Mutual<GetIssueByIdResult, Awaited<ReturnType<RemoteTrackerAdapter['getIssueById']>>>
    : false;

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

type ResultShapesAgreed =
  Mutual<RemoteIssueSearchResult, SearchIssuesResult[number]> extends true
    ? Mutual<RemoteFieldOption, GetActivityOptionsResult[number]> extends true
      ? Mutual<RemoteTimeLogDto, FetchTimeLogsResult[number]>
      : false
    : false;

export type ProtocolMatchesRemoteTrackerAdapter = SearchIssuesAgreed extends true
  ? GetIssueByIdAgreed extends true
    ? GetActivityOptionsAgreed extends true
      ? GetCurrentAccountAgreed extends true
        ? FetchTimeLogsAgreed extends true
          ? FetchTimeLogsInRangeAgreed extends true
            ? CreateTimeEntryAgreed extends true
              ? ResultShapesAgreed
              : false
            : false
          : false
        : false
      : false
    : false
  : false;

export const protocolMatchesRemoteTrackerAdapter: ProtocolMatchesRemoteTrackerAdapter = true;
