import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const distRoot = join(packageRoot, 'dist');

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function referencedPaths(manifest: {
  background: { service_worker: string };
  action: { default_popup: string };
  options_ui: { page: string };
}): string[] {
  return [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_ui.page,
    'content.js',
  ];
}

function htmlAssetPaths(htmlPath: string): string[] {
  const html = readFileSync(htmlPath, 'utf8');
  const matches = [...html.matchAll(/(?:src|href)="([^"]+)"/g)];
  return matches
    .map((match) => match[1])
    .filter(
      (value) =>
        value.startsWith('./') ||
        value.startsWith('../') ||
        value.startsWith('/') ||
        value.startsWith('assets/'),
    );
}

describe('unpacked extension output', () => {
  it('contains every manifest-referenced file and no web-app source', () => {
    expect(existsSync(join(distRoot, 'manifest.json'))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(distRoot, 'manifest.json'), 'utf8')) as {
      background: { service_worker: string; type: string };
      action: { default_popup: string };
      options_ui: { page: string };
      content_security_policy: { extension_pages: string };
    };

    expect(manifest.background.type).toBe('module');
    expect(manifest.content_security_policy.extension_pages).toContain("script-src 'self'");

    for (const relativePath of referencedPaths(manifest)) {
      expect(existsSync(join(distRoot, relativePath))).toBe(true);
    }

    const popupHtml = join(distRoot, manifest.action.default_popup);
    const optionsHtml = join(distRoot, manifest.options_ui.page);
    for (const htmlPath of [popupHtml, optionsHtml]) {
      for (const asset of htmlAssetPaths(htmlPath)) {
        const resolved = asset.startsWith('/')
          ? join(distRoot, asset.slice(1))
          : join(dirname(htmlPath), asset);
        expect(existsSync(resolved)).toBe(true);
      }
    }

    const distFiles = collectFiles(distRoot);
    expect(distFiles.some((file) => file.endsWith('content.js'))).toBe(true);
    for (const file of distFiles) {
      if (!file.endsWith('.js') && !file.endsWith('.html') && !file.endsWith('.json')) continue;
      const contents = readFileSync(file, 'utf8');
      expect(contents).not.toContain('apps/web');
      expect(contents).not.toContain('~~/');
      expect(contents).not.toContain('.nuxt');
      expect(contents).not.toContain('eval(');
    }
  });
});
