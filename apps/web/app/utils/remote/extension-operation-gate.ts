import { EXTENSION_RESOURCE_LIMITS } from '@osi/extension-protocol';

/**
 * Page-side FIFO admission gate bounding concurrent extension operations to
 * the protocol's in-flight limit. The extension worker rejects a burst past
 * that limit outright (REQ-331); every page call site that can generate a
 * burst (a Remote Sync day, the monthly report, the issue picker, the
 * project catalog) shares one gate instance so the limit becomes a
 * throughput bound instead of a failure mode.
 */
export class ExtensionOperationGate {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

/** Shared per-document gate for every extension call site in this app. */
export const extensionOperationGate = new ExtensionOperationGate(
  EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument,
);
