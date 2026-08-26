import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from '../../server/utils/is-unique-violation';

describe('isUniqueViolation', () => {
  it('detects postgres unique_violation on an Error with code 23505', () => {
    const err = new Error('duplicate');
    Object.assign(err, { code: '23505' });
    expect(isUniqueViolation(err)).toBe(true);
  });

  it('returns false for a generic Error', () => {
    expect(isUniqueViolation(new Error('nope'))).toBe(false);
  });
});
