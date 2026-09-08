import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Worker } from 'playwright';
import { z } from 'zod';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

export function extensionDistPath(): string {
  return join(packageRoot, 'dist');
}

export interface ExtensionHarness {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  close: () => Promise<void>;
}

/** Copy dist and grant host access so tests do not hang on Chrome's permission prompt. */
async function unpackedExtensionForTests(): Promise<string> {
  const pathToExtension = await mkdtemp(join(tmpdir(), 'osi-extension-unpacked-'));
  await cp(extensionDistPath(), pathToExtension, { recursive: true });
  const manifestPath = join(pathToExtension, 'manifest.json');
  const manifest = z
    .object({ host_permissions: z.array(z.string()).optional() })
    .passthrough()
    .parse(JSON.parse(await readFile(manifestPath, 'utf8')));
  manifest.host_permissions = ['http://*/*', 'https://*/*'];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return pathToExtension;
}

/** Persistent Chromium profile with the unpacked extension loaded. */
export async function launchExtensionContext(): Promise<ExtensionHarness> {
  const userDataDir = await mkdtemp(join(tmpdir(), 'osi-extension-'));
  const pathToExtension = await unpackedExtensionForTests();
  // `channel: 'chromium'` is required for MV3 extensions in headless Playwright.
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`],
  });

  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
  const extensionId = new URL(worker.url()).host;

  return {
    context,
    worker,
    extensionId,
    close: async () => {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
      await rm(pathToExtension, { recursive: true, force: true });
    },
  };
}
