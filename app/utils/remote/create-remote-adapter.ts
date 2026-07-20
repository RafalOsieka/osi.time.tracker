import { OpenProjectAdapter } from '../../../shared/remote/openproject/adapter';
import { RedmineAdapter } from '../../../shared/remote/redmine/adapter';
import type { RemoteTrackerAdapter } from '../../../shared/types/remote-adapter';
import type { RemoteSystemConfigDto } from '../../../shared/types/remote-system-config';
import { clientFetchTransport } from './client-fetch-transport';
import { ServerExecutionAdapter } from './server-execution-adapter';

/**
 * Selects and builds the `RemoteTrackerAdapter` for one call: `client`
 * execution mode returns the provider adapter matched by `systemType` over
 * the browser-direct transport; `server` execution mode returns the thin
 * `ServerExecutionAdapter`, which delegates each operation to the matching
 * `/api/remote/*` endpoint (itself backed by the same provider adapter,
 * server-side). `secret` is resolved by the caller for this call.
 */
export function createRemoteAdapter(
  config: RemoteSystemConfigDto,
  secret: string | null,
): RemoteTrackerAdapter {
  if (config.executionMode === 'server') {
    return new ServerExecutionAdapter(config.id, secret);
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
