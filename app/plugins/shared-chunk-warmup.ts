// Touches the shared cross-boundary modules the Remote Sync page needs so
// they get bundled into the stable, multi-referenced app chunk instead of
// being inlined into that page's own route chunk (where relative imports
// into `shared/` are miscomputed by the production build). No runtime
// behavior — this plugin performs no work of its own.
import { applyRoundingRule } from '~~/shared/utils/rounding';
import { deriveRemoteSyncRowState } from '~~/shared/utils/remote-sync-row-state';
import { normalizeBaseUrl } from '~~/shared/utils/normalize-base-url';
import { REMOTE_SECRET_HEADER } from '~~/shared/config/remote-secret';
import { RemoteAdapterError } from '~~/shared/types/remote-adapter';
import { OpenProjectAdapter } from '~~/shared/remote/openproject/adapter';
import { OpenProjectClient } from '~~/shared/remote/openproject/client';
import { RedmineAdapter } from '~~/shared/remote/redmine/adapter';
import { RedmineClient } from '~~/shared/remote/redmine/client';

export default defineNuxtPlugin(() => {
  if (process.env.NODE_ENV === '__never__') {
    // Referenced only to keep the imports live for bundlers; never executed.
    applyRoundingRule(0, 'none');
    deriveRemoteSyncRowState({
      hasProject: false,
      hasClient: false,
      config: null,
      hasIssueRef: false,
    });
    normalizeBaseUrl('');
    void REMOTE_SECRET_HEADER;
    void new RemoteAdapterError('');
    void OpenProjectAdapter;
    void OpenProjectClient;
    void RedmineAdapter;
    void RedmineClient;
  }
});
