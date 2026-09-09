// Touches the shared cross-boundary modules the Remote Sync page needs so
// they get bundled into the stable, multi-referenced app chunk instead of
// being inlined into that page's own route chunk (where relative imports
// into `shared/` are miscomputed by the production build). This is a
// production-bundler workaround, not a runtime optimization: the plugin
// performs no work of its own.
import { applyRoundingRule, roundingSuggestionsFor } from '~~/shared/utils/rounding';
import { deriveRemoteSyncRowState } from '~~/shared/utils/remote-sync-row-state';
import { computeRemoteSyncDayTotals } from '~~/shared/utils/remote-sync-day-totals';
import { findDuplicateRemoteLog } from '~~/shared/utils/find-duplicate-remote-log';
import { buildExportRequestKey } from '~~/shared/utils/export-request-key';
import { resolveExportComment } from '~~/shared/utils/export-comment';
import {
  REMOTE_ISSUE_SEARCH_MODE_ORDER,
  RemoteAdapterError,
  UpstreamHttpError,
  normalizeBaseUrl,
} from '@osi/remote-trackers/contracts';
import { OpenProjectAdapter, OpenProjectClient } from '@osi/remote-trackers/openproject';
import { RedmineAdapter, RedmineClient } from '@osi/remote-trackers/redmine';
import { REMOTE_SECRET_HEADER } from '~~/shared/config/remote-secret';
import { remoteIssuePickerFormSchema } from '~~/shared/types/remote-issue-ref';
import { finalizeRemoteExportSchema } from '~~/shared/types/remote-export';
import { createTrackerSchema } from '~~/shared/types/tracker';

export default defineNuxtPlugin(() => {
  void applyRoundingRule;
  void roundingSuggestionsFor;
  void deriveRemoteSyncRowState;
  void computeRemoteSyncDayTotals;
  void findDuplicateRemoteLog;
  void buildExportRequestKey;
  void resolveExportComment;
  void normalizeBaseUrl;
  void REMOTE_SECRET_HEADER;
  void RemoteAdapterError;
  void UpstreamHttpError;
  void REMOTE_ISSUE_SEARCH_MODE_ORDER;
  void remoteIssuePickerFormSchema;
  void finalizeRemoteExportSchema;
  void createTrackerSchema;
  void OpenProjectAdapter;
  void OpenProjectClient;
  void RedmineAdapter;
  void RedmineClient;
});
