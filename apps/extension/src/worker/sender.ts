export interface RuntimeSender {
  origin: string;
  frameId?: number;
  url?: string;
}

/** Top-frame documents on an approved OSI origin may command the worker. */
export function isTrustedDocumentSender(
  sender: RuntimeSender,
  approvedOrigins: readonly string[],
): boolean {
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;
  return approvedOrigins.includes(sender.origin);
}
