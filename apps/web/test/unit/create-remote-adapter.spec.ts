import { describe, expect, it } from 'vitest';
import { createRemoteAdapter } from '../../app/utils/remote/create-remote-adapter';
import { OpenProjectAdapter } from '@osi/remote-trackers/openproject';
import { RedmineAdapter } from '@osi/remote-trackers/redmine';
import { ExtensionExecutionAdapter } from '../../app/utils/remote/extension-execution-adapter';
import { ServerExecutionAdapter } from '../../app/utils/remote/server-execution-adapter';
import type { TrackerDto } from '../../shared/types/tracker';

const baseConfig: TrackerDto = {
  id: 'config-1',
  name: 'OpenProject',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  executionMode: 'client',
  roundingRule: 'none',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('createRemoteAdapter', () => {
  it('selects the OpenProject adapter for client execution mode', () => {
    const adapter = createRemoteAdapter(baseConfig, 'secret');
    expect(adapter).toBeInstanceOf(OpenProjectAdapter);
  });

  it('selects the Redmine adapter for client execution mode', () => {
    const adapter = createRemoteAdapter({ ...baseConfig, systemType: 'redmine' }, 'secret');
    expect(adapter).toBeInstanceOf(RedmineAdapter);
  });

  it('selects the server-execution adapter for server execution mode', () => {
    const adapter = createRemoteAdapter({ ...baseConfig, executionMode: 'server' }, 'secret');
    expect(adapter).toBeInstanceOf(ServerExecutionAdapter);
  });

  it('selects the extension adapter and does not fall back to client or server adapters', () => {
    const adapter = createRemoteAdapter({ ...baseConfig, executionMode: 'extension' }, 'secret');
    expect(adapter).toBeInstanceOf(ExtensionExecutionAdapter);
    expect(adapter).not.toBeInstanceOf(OpenProjectAdapter);
    expect(adapter).not.toBeInstanceOf(ServerExecutionAdapter);
  });
});
