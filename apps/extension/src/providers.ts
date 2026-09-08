import { OpenProjectAdapter } from '@osi/remote-trackers/openproject';
import { RedmineAdapter } from '@osi/remote-trackers/redmine';
import type { RemoteTrackerAdapter, Transport } from '@osi/remote-trackers/contracts';
import type { TrackerSystemType } from '@osi/remote-trackers/contracts';

export { OpenProjectAdapter, RedmineAdapter };
export type { RemoteTrackerAdapter, Transport };

/** Builds the shared provider adapter for an approved destination. */
export function createProviderAdapter(
  provider: TrackerSystemType,
  transport: Transport,
  baseUrl: string,
  secret: string,
): RemoteTrackerAdapter {
  switch (provider) {
    case 'openproject':
      return new OpenProjectAdapter(transport, baseUrl, secret);
    case 'redmine':
      return new RedmineAdapter(transport, baseUrl, secret);
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}
