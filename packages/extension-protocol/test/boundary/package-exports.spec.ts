import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RemoteAdapterError } from '@osi/remote-trackers/contracts';
import {
  EXTENSION_PROTOCOL_VERSION,
  reconstructAdapterError,
  serializeAdapterError,
} from '../../src/index.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('extension-protocol public exports', () => {
  it('resolves contracts without Nuxt types', () => {
    expect(EXTENSION_PROTOCOL_VERSION).toBe(1);
    const error = reconstructAdapterError(
      serializeAdapterError(new RemoteAdapterError('error.remoteIssueSearchFailed', 502)),
    );
    expect(error).toBeInstanceOf(RemoteAdapterError);
    expect(error.messageKey).toBe('error.remoteIssueSearchFailed');
  });

  it('emits JavaScript and declarations without Nuxt paths', () => {
    const js = readFileSync(join(packageRoot, 'dist', 'index.js'), 'utf8');
    const dts = readFileSync(join(packageRoot, 'dist', 'index.d.ts'), 'utf8');
    expect(js.length).toBeGreaterThan(0);
    expect(dts.length).toBeGreaterThan(0);
    expect(js).not.toContain('~~/');
    expect(js).not.toContain('.nuxt');
    expect(dts).not.toContain('~~/');
    expect(dts).not.toContain('.nuxt');
  });
});
