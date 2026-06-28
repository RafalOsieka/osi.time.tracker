import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { normalizeEmail, DUMMY_HASH } from '../../server/utils/users';

const require = createRequire(import.meta.resolve('nuxt-auth-utils'));
const hashMjsPath = 'file:///' + require.resolve('@adonisjs/hash').replace(/\\/g, '/');
const scryptMjsPath =
  'file:///' + require.resolve('@adonisjs/hash/drivers/scrypt').replace(/\\/g, '/');

describe('normalizeEmail', () => {
  it('trims whitespace and converts to lowercase', () => {
    expect(normalizeEmail('  Bob@Example.com  ')).toBe('bob@example.com');
    expect(normalizeEmail('alice@DOMAIN.CO.UK')).toBe('alice@domain.co.uk');
  });

  it('can hash and verify password with @adonisjs/hash scrypt', async () => {
    const { Hash } = await import(hashMjsPath);
    const { Scrypt } = await import(scryptMjsPath);

    const scrypt = new Scrypt({});
    const hasher = new Hash(scrypt);

    const password = 'mySecretPassword';
    const hashValue = await hasher.make(password);
    expect(hashValue).toBeDefined();
    expect(typeof hashValue).toBe('string');
    expect(hashValue.startsWith('$scrypt$')).toBe(true);

    const match = await hasher.verify(hashValue, password);
    expect(match).toBe(true);

    const mismatch = await hasher.verify(hashValue, 'wrongPassword');
    expect(mismatch).toBe(false);
  });

  it('verifies against dummy hash safely and returns false', async () => {
    const { Hash } = await import(hashMjsPath);
    const { Scrypt } = await import(scryptMjsPath);

    const scrypt = new Scrypt({});
    const hasher = new Hash(scrypt);

    // Assert that verifying against DUMMY_HASH doesn't throw and returns false
    const match = await hasher.verify(DUMMY_HASH, 'anyPassword');
    expect(match).toBe(false);
  });
});
