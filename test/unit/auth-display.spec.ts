import { describe, expect, it } from 'vitest';
import { getAuthStatusMessage } from '../../app/utils/authDisplay';

describe('getAuthStatusMessage', () => {
  it('reports logged-out state', () => {
    expect(getAuthStatusMessage(false)).toEqual({ key: 'home.statusLoggedOut' });
    expect(getAuthStatusMessage(false, { email: 'ignored@example.com' })).toEqual({
      key: 'home.statusLoggedOut',
    });
  });

  it('greets the user by displayName or email when logged in', () => {
    expect(
      getAuthStatusMessage(true, { displayName: 'alice', email: 'alice@example.com' }),
    ).toEqual({
      key: 'home.statusLoggedInAs',
      params: { name: 'alice' },
    });
    expect(getAuthStatusMessage(true, { displayName: '  bob  ' })).toEqual({
      key: 'home.statusLoggedInAs',
      params: { name: 'bob' },
    });
    expect(getAuthStatusMessage(true, { email: 'alice@example.com' })).toEqual({
      key: 'home.statusLoggedInAs',
      params: { name: 'alice@example.com' },
    });
  });

  it('falls back to a generic label when the name and email are missing', () => {
    expect(getAuthStatusMessage(true)).toEqual({ key: 'home.statusLoggedIn' });
    expect(getAuthStatusMessage(true, null)).toEqual({ key: 'home.statusLoggedIn' });
    expect(getAuthStatusMessage(true, { displayName: '   ' })).toEqual({
      key: 'home.statusLoggedIn',
    });
  });
});
