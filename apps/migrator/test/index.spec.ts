import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Hash } from '@adonisjs/hash';
import { Scrypt } from '@adonisjs/hash/drivers/scrypt';
import { describe, expect, it } from 'vite-plus/test';
import { MIGRATIONS_FOLDER, hashPassword, readBootstrapUser } from '../src/index.js';

describe('MIGRATIONS_FOLDER', () => {
  it('points at the committed migrations with their drizzle journal', () => {
    expect(existsSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'))).toBe(true);
    expect(existsSync(join(MIGRATIONS_FOLDER, '0000_lyrical_justice.sql'))).toBe(true);
  });
});

describe('readBootstrapUser', () => {
  it('trims and lowercases the email, keeps the password, and defaults the profile', () => {
    expect(
      readBootstrapUser({
        BOOTSTRAP_USER_EMAIL: '  Admin@Example.COM ',
        BOOTSTRAP_USER_PASSWORD: ' secret ',
      }),
    ).toEqual({
      email: 'admin@example.com',
      password: ' secret ',
      displayName: 'admin',
      timezone: 'UTC',
    });
  });

  it('uses the trimmed display name and timezone when given', () => {
    expect(
      readBootstrapUser({
        BOOTSTRAP_USER_EMAIL: 'jan@example.com',
        BOOTSTRAP_USER_PASSWORD: 'secret',
        BOOTSTRAP_USER_DISPLAY_NAME: '  Jan Kowalski ',
        BOOTSTRAP_USER_TIMEZONE: ' Europe/Warsaw ',
      }),
    ).toMatchObject({ displayName: 'Jan Kowalski', timezone: 'Europe/Warsaw' });
  });

  it('falls back to the email local part when the display name is blank', () => {
    expect(
      readBootstrapUser({
        BOOTSTRAP_USER_EMAIL: 'jan@example.com',
        BOOTSTRAP_USER_PASSWORD: 'secret',
        BOOTSTRAP_USER_DISPLAY_NAME: '   ',
      }),
    ).toMatchObject({ displayName: 'jan' });
  });

  it.each([
    { variable: 'BOOTSTRAP_USER_TIMEZONE', env: { BOOTSTRAP_USER_TIMEZONE: 'Mars/Olympus' } },
    {
      variable: 'BOOTSTRAP_USER_DISPLAY_NAME',
      env: { BOOTSTRAP_USER_DISPLAY_NAME: 'x'.repeat(101) },
    },
  ])('throws naming $variable when it is invalid', ({ variable, env }) => {
    expect(() =>
      readBootstrapUser({
        BOOTSTRAP_USER_EMAIL: 'jan@example.com',
        BOOTSTRAP_USER_PASSWORD: 'secret',
        ...env,
      }),
    ).toThrow(variable);
  });

  it('ignores invalid profile variables when seeding is disabled', () => {
    expect(readBootstrapUser({ BOOTSTRAP_USER_TIMEZONE: 'Mars/Olympus' })).toBeUndefined();
  });

  it.each([
    { name: 'both unset', env: {} },
    { name: 'email unset', env: { BOOTSTRAP_USER_PASSWORD: 'secret' } },
    { name: 'password unset', env: { BOOTSTRAP_USER_EMAIL: 'a@example.com' } },
    { name: 'blank email', env: { BOOTSTRAP_USER_EMAIL: '   ', BOOTSTRAP_USER_PASSWORD: 'x' } },
    {
      name: 'empty password',
      env: { BOOTSTRAP_USER_EMAIL: 'a@example.com', BOOTSTRAP_USER_PASSWORD: '' },
    },
  ])('skips seeding when $name', ({ env }) => {
    expect(readBootstrapUser(env)).toBeUndefined();
  });
});

describe('hashPassword', () => {
  it('produces a scrypt hash that the default scrypt verifier accepts', async () => {
    const hash = await hashPassword('correct horse');

    expect(hash.startsWith('$scrypt$')).toBe(true);
    const verifier = new Hash(new Scrypt({}));
    expect(await verifier.verify(hash, 'correct horse')).toBe(true);
    expect(await verifier.verify(hash, 'wrong')).toBe(false);
  });
});
