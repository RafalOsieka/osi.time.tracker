import { describe, expect, it } from 'vitest';
import { createServerRemoteAdapter } from '../../server/utils/remote/create-server-remote-adapter';
import { OpenProjectAdapter } from '../../shared/remote/openproject/adapter';
import { RedmineAdapter } from '../../shared/remote/redmine/adapter';

describe('createServerRemoteAdapter', () => {
  it('selects the OpenProject adapter for the openproject system type', () => {
    const adapter = createServerRemoteAdapter(
      { systemType: 'openproject', baseUrl: 'https://op.example.com' },
      'secret',
    );
    expect(adapter).toBeInstanceOf(OpenProjectAdapter);
  });

  it('selects the Redmine adapter for the redmine system type', () => {
    const adapter = createServerRemoteAdapter(
      { systemType: 'redmine', baseUrl: 'https://redmine.example.com' },
      'secret',
    );
    expect(adapter).toBeInstanceOf(RedmineAdapter);
  });
});
