import { OpenProjectAdapter } from '../../../shared/remote/openproject/adapter';
import { RedmineAdapter } from '../../../shared/remote/redmine/adapter';
import type { RemoteTrackerAdapter } from '../../../shared/types/remote-adapter';
import type { RemoteSystemType } from '../../../shared/types/remote-system-config';
import { createServerFetchTransport } from './server-fetch-transport';

/**
 * Selects and builds the `RemoteTrackerAdapter` for `server`-execution-mode
 * `/api/remote/*` endpoints, keyed by the owned config's `systemType`. This
 * is the single place these endpoints construct a provider adapter; adding a
 * new provider only means adding a case here (mirroring the `client`-side
 * `createRemoteAdapter`).
 */
export function createServerRemoteAdapter(
  config: { systemType: RemoteSystemType; baseUrl: string },
  secret: string,
): RemoteTrackerAdapter {
  switch (config.systemType) {
    case 'openproject':
      return new OpenProjectAdapter(
        createServerFetchTransport(config.baseUrl),
        config.baseUrl,
        secret,
      );
    case 'redmine':
      return new RedmineAdapter(createServerFetchTransport(config.baseUrl), config.baseUrl, secret);
    default:
      throw { data: { data: { messageKey: 'remoteSync.state.systemNotImplemented' } } };
  }
}
