import { describe, it, expect } from 'vitest';
import { extractMessageKey } from '../../app/utils/extractMessageKey';

describe('extractMessageKey', () => {
  it('returns fallback for null', () => {
    expect(extractMessageKey(null, 'fallback')).toBe('fallback');
  });

  it('returns fallback for non-object', () => {
    expect(extractMessageKey('string error', 'fallback')).toBe('fallback');
  });

  it('returns fallback when data is missing', () => {
    expect(extractMessageKey({}, 'fallback')).toBe('fallback');
  });

  it('returns messageKey from err.data.data.messageKey (Nitro createError shape)', () => {
    const err = { data: { statusCode: 422, data: { messageKey: 'error.clientNameDuplicate' } } };
    expect(extractMessageKey(err, 'fallback')).toBe('error.clientNameDuplicate');
  });

  it('returns fallback when nested data has no messageKey', () => {
    const err = { data: { statusCode: 422, data: { other: 'value' } } };
    expect(extractMessageKey(err, 'fallback')).toBe('fallback');
  });

  it('returns fallback when err.data has no nested data object', () => {
    const err = { data: { statusCode: 422 } };
    expect(extractMessageKey(err, 'fallback')).toBe('fallback');
  });
});
