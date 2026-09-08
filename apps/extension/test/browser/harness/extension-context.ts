import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Worker } from 'playwright';

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

/** Persistent Chromium profile with the unpacked extension loaded. */
export async function launchExtensionContext(): Promise<ExtensionHarness> {
  const userDataDir = await mkdtemp(join(tmpdir(), 'osi-extension-'));
  const pathToExtension = extensionDistPath();
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
    },
  };
}
