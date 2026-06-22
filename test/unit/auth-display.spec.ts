import { describe, expect, it } from 'vitest';
import { authStatusKey } from '../../app/utils/authDisplay';

describe('authStatusKey', () => {
  it('reports logged-out state', () => {
    expect(authStatusKey(false)).toEqual({ key: 'home.statusLoggedOut' });
    expect(authStatusKey(false, { email: 'ignored@example.com' })).toEqual({
      key: 'home.statusLoggedOut',
    });
  });

  it('greets the user by displayName or email when logged in', () => {
    expect(authStatusKey(true, { displayName: 'alice', email: 'alice@example.com' })).toEqual({
      key: 'home.statusLoggedInAs',
      params: { name: 'alice' },
    });
    expect(authStatusKey(true, { displayName: '  bob  ' })).toEqual({
      key: 'home.statusLoggedInAs',
      params: { name: 'bob' },
    });
    expect(authStatusKey(true, { email: 'alice@example.com' })).toEqual({
      key: 'home.statusLoggedInAs',
      params: { name: 'alice@example.com' },
    });
  });

  it('falls back to a generic label when the name and email are missing', () => {
    expect(authStatusKey(true)).toEqual({ key: 'home.statusLoggedIn' });
    expect(authStatusKey(true, null)).toEqual({ key: 'home.statusLoggedIn' });
    expect(authStatusKey(true, { displayName: '   ' })).toEqual({ key: 'home.statusLoggedIn' });
  });
});
