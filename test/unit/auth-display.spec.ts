import { describe, expect, it } from 'vitest';
import { authStatusLabel } from '../../app/utils/authDisplay';

describe('authStatusLabel', () => {
  it('reports logged-out state', () => {
    expect(authStatusLabel(false)).toBe('You are not logged in');
    expect(authStatusLabel(false, { name: 'ignored' })).toBe('You are not logged in');
  });

  it('greets the user by name when logged in', () => {
    expect(authStatusLabel(true, { name: 'alice' })).toBe('Logged in as alice');
    expect(authStatusLabel(true, { name: '  bob  ' })).toBe('Logged in as bob');
  });

  it('falls back to a generic label when the name is missing', () => {
    expect(authStatusLabel(true)).toBe('Logged in');
    expect(authStatusLabel(true, null)).toBe('Logged in');
    expect(authStatusLabel(true, { name: '   ' })).toBe('Logged in');
  });
});
