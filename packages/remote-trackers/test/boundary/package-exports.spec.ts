import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RemoteAdapterError,
  deriveIssueUrl,
  normalizeBaseUrl,
} from '@osi/remote-trackers/contracts';
import { OpenProjectAdapter } from '@osi/remote-trackers/openproject';
import { RedmineAdapter } from '@osi/remote-trackers/redmine';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('package public exports', () => {
  it('resolves executable contracts and providers in Node', () => {
    expect(new RemoteAdapterError('error.remoteIssueSearchFailed').name).toBe('RemoteAdapterError');
    expect(normalizeBaseUrl('https://op.example.com/')).toBe('https://op.example.com');
    expect(deriveIssueUrl('redmine', 'https://rm.example.com/', '1')).toBe(
      'https://rm.example.com/issues/1',
    );
    expect(OpenProjectAdapter.name).toBe('OpenProjectAdapter');
    expect(RedmineAdapter.name).toBe('RedmineAdapter');
  });

  it('emits declarations next to JavaScript for public subpaths', () => {
    for (const subpath of ['contracts', 'openproject', 'redmine']) {
      const js = readFileSync(join(packageRoot, 'dist', subpath, 'index.js'), 'utf8');
      const dts = readFileSync(join(packageRoot, 'dist', subpath, 'index.d.ts'), 'utf8');
      expect(js.length).toBeGreaterThan(0);
      expect(dts.length).toBeGreaterThan(0);
      expect(js).not.toContain('~~/');
      expect(js).not.toContain('.nuxt');
    }
  });

  it('rejects undeclared deep imports', async () => {
    const blocked = [
      '@osi/remote-trackers/internal/remote-id',
      '@osi/remote-trackers/src/contracts/json.js',
    ];
    for (const specifier of blocked) {
      await expect(import(/* @vite-ignore */ specifier)).rejects.toThrow(/is not exported/);
    }
  });
});
