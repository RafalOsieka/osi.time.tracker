import { describe, expect, it } from 'vitest';
import { createRemoteAdapter } from '../../app/utils/remote/create-remote-adapter';
import { OpenProjectAdapter } from '../../shared/remote/openproject/adapter';
import { RedmineAdapter } from '../../shared/remote/redmine/adapter';
import { ServerExecutionAdapter } from '../../app/utils/remote/server-execution-adapter';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';

const baseConfig: RemoteSystemConfigDto = {
  id: 'config-1',
  clientId: 'client-1',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  executionMode: 'client',
  roundingRule: 'none',
  requiredFieldDefaults: {},
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
});
