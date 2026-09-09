export interface RuntimeSender {
  id?: string;
  origin?: string;
  url?: string;
  frameId?: number;
  tabId?: number;
  documentId?: string;
}

/** Stable in-memory key for per-document in-flight limits. */
export function documentKey(sender: RuntimeSender): string {
  if (sender.documentId) return `doc:${sender.documentId}`;
  return `tab:${sender.tabId ?? 'none'}:frame:${sender.frameId ?? 0}:origin:${sender.origin ?? ''}`;
}

/**
 * Top-frame documents from this extension on an approved OSI origin may
 * command the worker. Origin is taken from Chrome's sender, never the payload.
 */
export function isTrustedDocumentSender(
  sender: RuntimeSender,
  expectedExtensionId: string,
  approvedOrigins: readonly string[],
): boolean {
  if (!expectedExtensionId || sender.id !== expectedExtensionId) return false;
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;
  if (!sender.origin || !approvedOrigins.includes(sender.origin)) return false;
  if (!sender.url) return true;
  try {
    return new URL(sender.url).origin === sender.origin;
  } catch {
    return false;
  }
}
