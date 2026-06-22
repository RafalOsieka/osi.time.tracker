import { describe, expect, it } from 'vitest';
import { authStatusLabel } from '../../app/utils/authDisplay';

describe('authStatusLabel', () => {
  it('reports logged-out state', () => {
    expect(authStatusLabel(false)).toBe('You are not logged in');
    expect(authStatusLabel(false, { email: 'ignored@example.com' })).toBe('You are not logged in');
  });

  it('greets the user by displayName or email when logged in', () => {
    expect(authStatusLabel(true, { displayName: 'alice', email: 'alice@example.com' })).toBe(
      'Logged in as alice',
    );
    expect(authStatusLabel(true, { displayName: '  bob  ' })).toBe('Logged in as bob');
    expect(authStatusLabel(true, { email: 'alice@example.com' })).toBe(
      'Logged in as alice@example.com',
    );
  });

  it('falls back to a generic label when the name and email are missing', () => {
    expect(authStatusLabel(true)).toBe('Logged in');
    expect(authStatusLabel(true, null)).toBe('Logged in');
    expect(authStatusLabel(true, { displayName: '   ' })).toBe('Logged in');
  });
});
