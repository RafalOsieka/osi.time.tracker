import { describe, expect, it } from 'vitest';
import { createServerRemoteAdapter } from '../../server/utils/remote/create-server-remote-adapter';
import { OpenProjectAdapter } from '../../shared/remote/openproject/adapter';

describe('createServerRemoteAdapter', () => {
  it('selects the OpenProject adapter for the openproject system type', () => {
    const adapter = createServerRemoteAdapter(
      { systemType: 'openproject', baseUrl: 'https://op.example.com' },
      'secret',
    );
    expect(adapter).toBeInstanceOf(OpenProjectAdapter);
  });

  it('rejects an unimplemented system type', () => {
    expect(() =>
      createServerRemoteAdapter(
        { systemType: 'redmine', baseUrl: 'https://redmine.example.com' },
        'secret',
      ),
    ).toThrow();
  });
});
