// Touches the shared cross-boundary modules the Remote Sync page needs so
// they get bundled into the stable, multi-referenced app chunk instead of
// being inlined into that page's own route chunk (where relative imports
// into `shared/` are miscomputed by the production build). No runtime
// behavior — this plugin performs no work of its own.
import { REMOTE_SECRET_HEADER } from '~~/shared/config/remote-secret';
import { RemoteAdapterError } from '~~/shared/types/remote-adapter';
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
  void REMOTE_ISSUE_SEARCH_MODE_ORDER;
  void remoteIssuePickerFormSchema;
  void OpenProjectAdapter;
  void OpenProjectClient;
  void RedmineAdapter;
  void RedmineClient;
});
