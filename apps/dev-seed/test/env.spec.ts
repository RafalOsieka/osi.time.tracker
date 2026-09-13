import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENPROJECT_DEV_API_KEY,
  DEFAULT_REDMINE_DEV_API_KEY,
  parseDotEnv,
  resolveSeedEnv,
} from '../src/env.js';

describe('parseDotEnv', () => {
  it('reads keys, ignores comments and blank lines, strips quotes and trailing comments', () => {
    const parsed = parseDotEnv(
      [
        '# comment',
        '',
        'PLAIN=value',
        "SINGLE='quoted value'",
        'DOUBLE="other # not a comment"',
        'TRAILING=abc # comment',
        'NOVALUE=',
        '=broken',
      ].join('\n'),
    );
    expect([...parsed.entries()]).toEqual([
      ['PLAIN', 'value'],
      ['SINGLE', 'quoted value'],
      ['DOUBLE', 'other # not a comment'],
      ['TRAILING', 'abc'],
      ['NOVALUE', ''],
    ]);
  });
});

describe('resolveSeedEnv', () => {
  it('falls back to the compose defaults when nothing is set', () => {
    const env = resolveSeedEnv(null, {});
    expect(env).toEqual({
      openProject: { baseUrl: 'http://localhost:8090', apiKey: DEFAULT_OPENPROJECT_DEV_API_KEY },
      redmine: {
        baseUrl: 'http://localhost:8091',
        apiKey: DEFAULT_REDMINE_DEV_API_KEY,
        adminPassword: 'admin',
      },
    });
  });

  it('lets .env override defaults and the shell override .env, ignoring empty values', () => {
    const env = resolveSeedEnv(
      'OPENPROJECT_PORT=18090\nREDMINE_DEV_API_KEY=file-key\nREDMINE_PORT=\n',
      { REDMINE_DEV_API_KEY: 'shell-key', REDMINE_ADMIN_PASSWORD: '' },
    );
    expect(env.openProject.baseUrl).toBe('http://localhost:18090');
    expect(env.redmine.baseUrl).toBe('http://localhost:8091');
    expect(env.redmine.apiKey).toBe('shell-key');
    expect(env.redmine.adminPassword).toBe('admin');
  });

  it('rejects a non-numeric port', () => {
    expect(() => resolveSeedEnv('REDMINE_PORT=eighty', {})).toThrow();
  });
});
