import { describe, expect, it } from 'vitest';
import { OpenProjectAdapter } from '@osi/remote-trackers/openproject';
import { RedmineAdapter } from '@osi/remote-trackers/redmine';
import { RemoteAdapterError } from '@osi/remote-trackers/contracts';
import { EXTENSION_PROTOCOL_VERSION } from '@osi/extension-protocol';
import { createProviderAdapter } from '../../src/providers.js';

describe('extension package resolution', () => {
  it('resolves tracker and protocol exports without Nuxt', () => {
    expect(OpenProjectAdapter.name).toBe('OpenProjectAdapter');
    expect(RedmineAdapter.name).toBe('RedmineAdapter');
    expect(EXTENSION_PROTOCOL_VERSION).toBe(1);
    expect(new RemoteAdapterError('error.remoteIssueSearchFailed').name).toBe('RemoteAdapterError');
    expect(createProviderAdapter).toBeTypeOf('function');
  });
});
