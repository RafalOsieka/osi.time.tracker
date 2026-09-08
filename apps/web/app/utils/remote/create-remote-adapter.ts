import { OpenProjectAdapter } from '@osi/remote-trackers/openproject';
import { RedmineAdapter } from '@osi/remote-trackers/redmine';
import type { RemoteTrackerAdapter } from '@osi/remote-trackers/contracts';
import type { TrackerDto } from '../../../shared/types/tracker';
import { clientFetchTransport } from './client-fetch-transport';
import { ExtensionExecutionAdapter } from './extension-execution-adapter';
import { ServerExecutionAdapter } from './server-execution-adapter';

/**
 * Selects and builds the `RemoteTrackerAdapter` for one call: `client`
 * execution mode returns the provider adapter matched by `systemType` over
 * the browser-direct transport; `server` execution mode returns the thin
 * `ServerExecutionAdapter`, which delegates each operation to the matching
 * `/api/remote/*` endpoint (itself backed by the same provider adapter,
 * server-side); `extension` returns `ExtensionExecutionAdapter` and never
 * falls back to client or server execution. `secret` is resolved by the
 * caller for this call.
 */
export function createRemoteAdapter(
  config: TrackerDto,
  secret: string | null,
): RemoteTrackerAdapter {
  if (config.executionMode === 'server') {
    return new ServerExecutionAdapter(config.id, secret);
  }

  if (config.executionMode === 'extension') {
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
