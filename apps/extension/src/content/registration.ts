export function contentScriptId(origin: string): string {
  return `osi-bridge:${origin}`;
}

/** Registers the isolated content script for one approved OSI origin. */
export async function registerWebsiteContentScript(
  origin: string,
  scripting: ChromeScripting = chrome.scripting,
): Promise<void> {
  await navigator.locks.request('osi.content-script.registration', async () => {
    const id = contentScriptId(origin);
    const existing = await scripting.getRegisteredContentScripts();
    if (existing.some((script) => script.id === id)) return;
    await scripting.registerContentScripts([
      {
        id,
        matches: [`${origin}/*`],
        js: ['content.js'],
        runAt: 'document_start',
        world: 'ISOLATED',
        persistAcrossSessions: true,
      },
    ]);
  });
}

export async function unregisterWebsiteContentScript(
  origin: string,
  scripting: ChromeScripting = chrome.scripting,
): Promise<void> {
  const id = contentScriptId(origin);
  try {
    await scripting.unregisterContentScripts({ ids: [id] });
  } catch {
    // already unregistered
  }
}

export async function reconcileWebsiteContentScripts(
  origins: readonly string[],
  scripting: ChromeScripting = chrome.scripting,
): Promise<void> {
  const existing = await scripting.getRegisteredContentScripts();
  const wanted = new Set(origins.map(contentScriptId));
  const extra = existing
    .map((script) => script.id)
    .filter((id) => id.startsWith('osi-bridge:') && !wanted.has(id));
  if (extra.length > 0) {
    await scripting.unregisterContentScripts({ ids: extra });
  }
  for (const origin of origins) {
    await registerWebsiteContentScript(origin, scripting);
  }
}
