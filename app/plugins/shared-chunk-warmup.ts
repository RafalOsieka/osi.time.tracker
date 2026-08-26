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
import { normalizeBaseUrl } from '~~/shared/utils/normalize-base-url';
import { REMOTE_SECRET_HEADER } from '~~/shared/config/remote-secret';
import { RemoteAdapterError } from '~~/shared/types/remote-adapter';
import { UpstreamHttpError } from '~~/shared/remote/upstream-http-error';
import {
  REMOTE_ISSUE_SEARCH_MODE_ORDER,
  remoteIssuePickerFormSchema,
} from '~~/shared/types/remote-issue-ref';
import { OpenProjectAdapter } from '~~/shared/remote/openproject/adapter';
import { OpenProjectClient } from '~~/shared/remote/openproject/client';
import { RedmineAdapter } from '~~/shared/remote/redmine/adapter';
import { RedmineClient } from '~~/shared/remote/redmine/client';

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
  void OpenProjectAdapter;
  void OpenProjectClient;
  void RedmineAdapter;
  void RedmineClient;
});
