import { OpenProjectAdapter } from '@osi/remote-trackers/openproject';
import { RedmineAdapter } from '@osi/remote-trackers/redmine';
import type { RemoteTrackerAdapter } from '@osi/remote-trackers/contracts';
import type { TrackerDto } from '../../../shared/types/tracker';
import { clientFetchTransport } from './client-fetch-transport';
import { ExtensionExecutionAdapter } from './extension-execution-adapter';

/**
 * Selects and builds the `RemoteTrackerAdapter` for one call from the
 * tracker's persisted capability: `directBrowserAccess: true` returns the
 * provider adapter matched by `systemType` over the browser-direct
 * transport; `false` returns `ExtensionExecutionAdapter` and never falls
 * back to client execution. `secret` is resolved by the caller for this call.
 */
export function createRemoteAdapter(
  config: TrackerDto,
  secret: string | null,
): RemoteTrackerAdapter {
  if (!config.directBrowserAccess) {
    return new ExtensionExecutionAdapter(config, secret);
  }

  switch (config.systemType) {
    case 'openproject':
      return new OpenProjectAdapter(clientFetchTransport, config.baseUrl, secret);
    case 'redmine':
      return new RedmineAdapter(clientFetchTransport, config.baseUrl, secret);
    default:
      throw { data: { data: { messageKey: 'remoteSync.state.systemNotImplemented' } } };
  }
}
