import { describe, expect, it } from 'vite-plus/test';
import { OpenProjectAdapter } from '@osi/time-tracker-remote-trackers/openproject';
import { RedmineAdapter } from '@osi/time-tracker-remote-trackers/redmine';
import { RemoteAdapterError } from '@osi/time-tracker-remote-trackers/contracts';
import { EXTENSION_PROTOCOL_VERSION } from '@osi/time-tracker-extension-protocol';
import { createProviderAdapter } from '../../src/providers.js';

describe('extension package resolution', () => {
  it('resolves tracker and protocol exports without Nuxt', () => {
    expect(OpenProjectAdapter.name).toBe('OpenProjectAdapter');
    expect(RedmineAdapter.name).toBe('RedmineAdapter');
    expect(EXTENSION_PROTOCOL_VERSION).toBe(3);
    expect(new RemoteAdapterError('error.remoteIssueSearchFailed').name).toBe('RemoteAdapterError');
    expect(createProviderAdapter).toBeTypeOf('function');
  });
});
