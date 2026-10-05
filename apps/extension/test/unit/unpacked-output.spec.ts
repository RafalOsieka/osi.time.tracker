import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';

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

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Pixel size from a PNG's IHDR chunk; throws when the file is missing or not a PNG. */
function pngSize(path: string) {
  const bytes = readFileSync(path);
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('unpacked extension output', () => {
  it('ships every declared icon as a PNG of its declared size', () => {
    const iconSet = z.record(z.string(), z.string());
    const manifest = z
      .object({ icons: iconSet, action: z.object({ default_icon: iconSet }) })
      .parse(JSON.parse(readFileSync(join(distRoot, 'manifest.json'), 'utf8')));

    expect(
      Object.keys(manifest.icons)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([16, 32, 48, 128]);
    for (const [size, path] of [
      ...Object.entries(manifest.icons),
      ...Object.entries(manifest.action.default_icon),
    ]) {
      expect(pngSize(join(distRoot, path))).toEqual({ width: Number(size), height: Number(size) });
    }
  });

  it('contains every manifest-referenced file and no web-app source', () => {
    expect(existsSync(join(distRoot, 'manifest.json'))).toBe(true);
    const manifest = z
      .object({
        background: z.object({ service_worker: z.string(), type: z.string() }),
        action: z.object({ default_popup: z.string() }),
        options_ui: z.object({ page: z.string() }),
        content_security_policy: z.object({ extension_pages: z.string() }),
      })
      .parse(JSON.parse(readFileSync(join(distRoot, 'manifest.json'), 'utf8')));

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
