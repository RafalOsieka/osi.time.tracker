import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext } from 'playwright';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

export function extensionDistPath(): string {
  return join(packageRoot, 'dist');
}

export interface ExtensionHarness {
  context: BrowserContext;
  close: () => Promise<void>;
}

/** Persistent Chromium profile with the unpacked extension loaded. */
export async function launchExtensionContext(): Promise<ExtensionHarness> {
  const userDataDir = await mkdtemp(join(tmpdir(), 'osi-extension-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      `--disable-extensions-except=${extensionDistPath()}`,
      `--load-extension=${extensionDistPath()}`,
    ],
  });

  return {
    context,
    close: async () => {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}
