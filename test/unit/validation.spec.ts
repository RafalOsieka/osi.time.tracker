import { describe, expect, it } from 'vitest';
import { validateClientName, CLIENT_NAME_MAX_LENGTH } from '../../server/utils/validation';

describe('validateClientName', () => {
  it('returns valid for a normal name', () => {
    const result = validateClientName('Acme Corp');
    expect(result.valid).toBe(true);
    expect(result.messageKey).toBeUndefined();
  });

  it('rejects empty string', () => {
    const result = validateClientName('');
    expect(result.valid).toBe(false);
    expect(result.messageKey).toBe('error.clientNameRequired');
  });

  it('rejects whitespace-only string', () => {
    const result = validateClientName('   ');
    expect(result.valid).toBe(false);
    expect(result.messageKey).toBe('error.clientNameRequired');
  });

  it('rejects non-string values', () => {
    expect(validateClientName(null).valid).toBe(false);
    expect(validateClientName(undefined).valid).toBe(false);
    expect(validateClientName(42).valid).toBe(false);
  });

  it('rejects name exceeding max length', () => {
    const longName = 'a'.repeat(CLIENT_NAME_MAX_LENGTH + 1);
    const result = validateClientName(longName);
    expect(result.valid).toBe(false);
    expect(result.messageKey).toBe('error.clientNameTooLong');
  });

  it('accepts name at exactly max length', () => {
    const maxName = 'a'.repeat(CLIENT_NAME_MAX_LENGTH);
    const result = validateClientName(maxName);
    expect(result.valid).toBe(true);
  });
});
