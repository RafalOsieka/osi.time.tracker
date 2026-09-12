import { describe, expect, it } from 'vitest';
import { EXTENSION_RESOURCE_LIMITS } from '@osi/extension-protocol';
import {
  ExtensionOperationGate,
  extensionOperationGate,
} from '../../app/utils/remote/extension-operation-gate';

/** Resolves once microtasks settle, without a fixed timer wait. */
function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

describe('ExtensionOperationGate', () => {
  it('runs up to the limit concurrently and queues the rest', async () => {
    const limit = 4;
    const gate = new ExtensionOperationGate(limit);
    let active = 0;
    let maxActive = 0;
    const resolvers: Array<() => void> = [];

    const tasks = Array.from({ length: limit + 2 }, (_, index) =>
      gate.run(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => resolvers.push(resolve));
        active -= 1;
        return index;
      }),
    );

    await flushMicrotasks();
    expect(maxActive).toBe(limit);
    expect(resolvers).toHaveLength(limit);

    // Release admitted tasks one at a time; each release should admit exactly one queued task.
    while (resolvers.length > 0) {
      resolvers.shift()!();
      await flushMicrotasks();
    }

    const results = await Promise.all(tasks);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
    expect(maxActive).toBe(limit);
  });

  it('releases the slot when a task rejects, so the next queued task still runs', async () => {
    const gate = new ExtensionOperationGate(1);
    const first = gate.run(async () => {
      throw new Error('boom');
    });
    const second = gate.run(async () => 'second');

    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe('second');
  });

  it('shared singleton admits exactly the protocol in-flight limit at once', async () => {
    const limit = EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument;
    let active = 0;
    let maxActive = 0;
    const resolvers: Array<() => void> = [];

    const tasks = Array.from({ length: limit + 3 }, () =>
      extensionOperationGate.run(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => resolvers.push(resolve));
        active -= 1;
      }),
    );

    await flushMicrotasks();
    expect(maxActive).toBe(limit);

    while (resolvers.length > 0) {
      resolvers.shift()!();
      await flushMicrotasks();
    }
    await Promise.all(tasks);
  });
});
