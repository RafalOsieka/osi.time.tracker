import {
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_RESOURCE_LIMITS,
  type ExtensionOperationName,
} from '@osi/extension-protocol';

export type PendingOutcome = 'matched' | 'late' | 'mismatch';

export interface PendingTimeoutError {
  kind: 'timeout';
  messageKey: typeof EXTENSION_ERROR_MESSAGE_KEYS.timeout;
  requestId: string;
  operation: ExtensionOperationName;
}

/**
 * Correlates in-flight page requests to worker replies for one document.
 * Late or mismatched replies are dropped; disconnect clears timers.
 */
export class PendingRequestTable {
  private readonly pending = new Map<
    string,
    { operation: ExtensionOperationName; timeoutId: ReturnType<typeof setTimeout> }
  >();

  constructor(
    private readonly onTimeout: (error: PendingTimeoutError) => void,
    private readonly timeoutMs: number = EXTENSION_RESOURCE_LIMITS.pageDeadlineMs,
    private readonly schedule: typeof setTimeout = setTimeout,
    private readonly unschedule: typeof clearTimeout = clearTimeout,
  ) {}

  add(requestId: string, operation: ExtensionOperationName): boolean {
    if (this.pending.has(requestId)) return false;
    const timeoutId = this.schedule(() => {
      this.pending.delete(requestId);
      this.onTimeout({
        kind: 'timeout',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.timeout,
        requestId,
        operation,
      });
    }, this.timeoutMs);
    this.pending.set(requestId, { operation, timeoutId });
    return true;
  }

  take(requestId: string, operation: ExtensionOperationName): PendingOutcome {
    const entry = this.pending.get(requestId);
    if (!entry) return 'late';
    if (entry.operation !== operation) return 'mismatch';
    this.unschedule(entry.timeoutId);
    this.pending.delete(requestId);
    return 'matched';
  }

  disconnect(): void {
    for (const entry of this.pending.values()) this.unschedule(entry.timeoutId);
    this.pending.clear();
  }
}
