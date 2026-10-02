import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from '../../server/utils/is-unique-violation';

describe('isUniqueViolation', () => {
  it('detects postgres unique_violation on an Error with code 23505', () => {
    const err = new Error('duplicate');
    Object.assign(err, { code: '23505' });
    expect(isUniqueViolation(err)).toBe(true);
  });

  it('detects a unique_violation wrapped as cause by drizzle', () => {
    const driverError = Object.assign(new Error('duplicate'), { code: '23505' });
    expect(isUniqueViolation(new Error('Failed query', { cause: driverError }))).toBe(true);
  });

  it('returns false for a generic Error', () => {
    expect(isUniqueViolation(new Error('nope'))).toBe(false);
    expect(isUniqueViolation(new Error('nope', { cause: new Error('inner') }))).toBe(false);
  });
});
