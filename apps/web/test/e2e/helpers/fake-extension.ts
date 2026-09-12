import type { Page } from 'playwright-core';
import { EXTENSION_RESOURCE_LIMITS } from '@osi/extension-protocol';

const CHANNEL = 'osi-extension-protocol';
const PROTOCOL_VERSION = 1;
const SUPPORTED_OPERATIONS = [
  'searchIssues',
  'getIssueById',
  'listProjects',
  'getActivityOptions',
  'getCurrentAccount',
  'fetchTimeLogs',
  'fetchTimeLogsInRange',
  'createTimeEntry',
  'deleteTimeEntry',
] as const;

export interface FakeExtensionState {
  creates: number;
  seenSecrets: string[];
  /** Successfully served requests, keyed by operation name. */
  operationCounts: Record<string, number>;
  /** Highest number of operations this fake ever had open at once. */
  maxConcurrent: number;
  /** Requests this fake rejected with the extension's own in-flight limit. */
  limitErrors: number;
}

declare global {
  interface Window {
    __osiFakeExtension?: FakeExtensionState;
  }
}

const DEFAULT_STATE: FakeExtensionState = {
  creates: 0,
  seenSecrets: [],
  operationCounts: {},
  maxConcurrent: 0,
  limitErrors: 0,
};

/**
 * Page-side protocol stub that rejects every handshake as unavailable.
 * Used for web UI journeys that must not wait for the 130s operation deadline.
 */
export async function installUnavailableExtension(page: Page): Promise<void> {
  await page.addInitScript(
    ({ channel }) => {
      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        // SAFETY: the page bridge posts `{ channel, type: 'connect' }` on this channel.
        const data = event.data as { channel?: string; type?: string };
        if (data.channel !== channel || data.type !== 'connect') return;
        const port = event.ports[0];
        if (!port) return;
        port.start();
        port.addEventListener('message', (message) => {
          // SAFETY: handshake requests are `{ type: 'handshake' }`.
          const payload = message.data as { type?: string };
          if (payload.type === 'handshake') {
            port.postMessage({
              kind: 'unavailable',
              messageKey: 'error.extensionUnavailable',
            });
          }
        });
      });
    },
    { channel: CHANNEL },
  );
}

/**
 * Page-side protocol stub that completes handshake, serves read operations,
 * POSTs a create to the tracker, then returns unknown-create instead of the id.
 */
export async function installLostCreateExtension(page: Page): Promise<void> {
  await page.addInitScript(
    ({ channel, protocolVersion, operations }) => {
      window.__osiFakeExtension = {
        creates: 0,
        seenSecrets: [],
        operationCounts: {},
        maxConcurrent: 0,
        limitErrors: 0,
      };
      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        // SAFETY: the page bridge posts `{ channel, type: 'connect' }` on this channel.
        const data = event.data as { channel?: string; type?: string };
        if (data.channel !== channel || data.type !== 'connect') return;
        const port = event.ports[0];
        if (!port) return;
        port.start();
        port.addEventListener('message', (message) => {
          // SAFETY: protocol envelopes are JSON objects with type/operation fields.
          const payload = message.data as {
            type?: string;
            requestId?: string;
            operation?: string;
            baseUrl?: string;
            secret?: string;
          };
          void handlePortMessage(port, payload);
        });
      });

      function succeed(
        port: MessagePort,
        requestId: string,
        operation: string,
        result:
          | { id: string; name: string }[]
          | { id: string; name: string }
          | { status: string }
          | { remoteProjectId: string; title: string }[]
          | null,
      ) {
        port.postMessage({
          type: 'operation-result',
          requestId,
          operation,
          ok: true,
          result,
        });
      }

      async function handlePortMessage(
        port: MessagePort,
        payload: {
          type?: string;
          requestId?: string;
          operation?: string;
          baseUrl?: string;
          secret?: string;
        },
      ): Promise<void> {
        const requestId = payload.requestId;
        const operation = payload.operation;
        const baseUrl = payload.baseUrl;
        const secret = payload.secret;
        if (payload.type === 'handshake') {
          port.postMessage({
            type: 'handshake-result',
            protocolVersion,
            supportedOperations: operations,
            destinationApproved: true,
          });
          return;
        }
        if (payload.type !== 'operation' || !requestId || !operation) return;
        if (secret) {
          window.__osiFakeExtension?.seenSecrets.push(secret);
        }
        if (operation === 'getActivityOptions') {
          succeed(port, requestId, operation, [{ id: '1', name: 'Development' }]);
          return;
        }
        if (operation === 'getCurrentAccount') {
          succeed(port, requestId, operation, { id: '7', name: 'Ada' });
          return;
        }
        if (
          operation === 'fetchTimeLogs' ||
          operation === 'fetchTimeLogsInRange' ||
          operation === 'searchIssues'
        ) {
          succeed(port, requestId, operation, []);
          return;
        }
        if (operation === 'getIssueById') {
          succeed(port, requestId, operation, null);
          return;
        }
        if (operation === 'listProjects') {
          succeed(port, requestId, operation, []);
          return;
        }
        if (operation === 'deleteTimeEntry') {
          succeed(port, requestId, operation, { status: 'deleted' });
          return;
        }
        if (operation === 'createTimeEntry') {
          const state = window.__osiFakeExtension;
          if (state) state.creates += 1;
          if (baseUrl) {
            await fetch(`${baseUrl.replace(/\/+$/, '')}/api/v3/time_entries`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ hours: 0.5 }),
            }).catch(() => undefined);
          }
          port.postMessage({
            type: 'operation-result',
            requestId,
            operation,
            ok: false,
            error: {
              kind: 'unknown-create',
              messageKey: 'error.extensionUnknownCreate',
            },
          });
        }
      }
    },
    { channel: CHANNEL, protocolVersion: PROTOCOL_VERSION, operations: [...SUPPORTED_OPERATIONS] },
  );
}

export async function readFakeExtensionState(page: Page): Promise<FakeExtensionState> {
  return page.evaluate((fallback) => window.__osiFakeExtension ?? fallback, DEFAULT_STATE);
}

/** Fixture shape for a fake `RemoteTimeLogDto`, including the REQ-341 optional fields. */
export interface FakeRemoteTimeLog {
  remoteLogId: string;
  remoteIssueId: string;
  spentOn: string;
  durationSeconds: number;
  activityId?: string | null;
  activityName?: string | null;
  comment?: string | null;
  remoteUserId?: string | null;
  remoteProjectId?: string;
  remoteProjectTitle?: string;
  remoteIssueTitle?: string;
}

export interface InstallExtensionOptions {
  /** Neutral activity options returned for `getActivityOptions` (default: one). */
  activities?: { id: string; name: string }[];
  /** In-flight cap this fake enforces, mirroring the real worker's limit. */
  limit?: number;
  /** Milliseconds an operation stays "open" before replying, so a burst genuinely overlaps. */
  responseDelayMs?: number;
  /** Logs returned for every `fetchTimeLogs` (same-day) call (default: none). */
  timeLogs?: FakeRemoteTimeLog[];
  /** Logs returned for every `fetchTimeLogsInRange` call (default: none). */
  timeLogsInRange?: FakeRemoteTimeLog[];
  /** Remote project catalog returned for `listProjects` (default: none). */
  projects?: { remoteProjectId: string; title: string; parentId?: string }[];
}

/**
 * Full page-side protocol stub used to exercise REQ-331: unconditionally
 * approves the destination, serves every read operation and creates, and
 * enforces the same per-document in-flight cap the real extension worker
 * does (REQ-310 companion), rejecting the overflow with the `limit` wire
 * error rather than queueing it. Every served operation is counted by name,
 * and the highest concurrent count observed is tracked, so a caller can
 * assert both "nothing hit the limit" and "no more calls than expected".
 */
export async function installExtension(
  page: Page,
  options: InstallExtensionOptions = {},
): Promise<void> {
  await page.addInitScript(
    ({
      channel,
      protocolVersion,
      operations,
      activities,
      limit,
      responseDelayMs,
      timeLogs,
      timeLogsInRange,
      projects,
    }) => {
      window.__osiFakeExtension = {
        creates: 0,
        seenSecrets: [],
        operationCounts: {},
        maxConcurrent: 0,
        limitErrors: 0,
      };
      let active = 0;

      // TEMP DEBUG — remove before merge
      console.log('[DBG fake-ext] listener installed');
      window.addEventListener('message', (event) => {
        console.log('[DBG fake-ext] window message', JSON.stringify(event.data));
        if (event.source !== window) return;
        // SAFETY: the page bridge posts `{ channel, type: 'connect' }` on this channel.
        const data = event.data as { channel?: string; type?: string };
        if (data.channel !== channel || data.type !== 'connect') return;
        const port = event.ports[0];
        if (!port) return;
        port.start();
        console.log('[DBG fake-ext] port ready, listening');
        port.addEventListener('message', (message) => {
          // SAFETY: protocol envelopes are JSON objects with type/operation fields.
          const payload = message.data as {
            type?: string;
            requestId?: string;
            operation?: string;
            baseUrl?: string;
            secret?: string;
          };
          console.log('[DBG fake-ext] port message', JSON.stringify(payload));
          void handlePortMessage(port, payload);
        });
      });

      function succeed(
        port: MessagePort,
        requestId: string,
        operation: string,
        result:
          | { id: string; name: string }[]
          | { id: string; name: string }
          | { status: string }
          | { remoteLogId: string }
          | FakeRemoteTimeLog[]
          | { remoteProjectId: string; title: string; parentId?: string }[]
          | null,
      ) {
        port.postMessage({ type: 'operation-result', requestId, operation, ok: true, result });
      }

      function respond(port: MessagePort, requestId: string, operation: string) {
        const state = window.__osiFakeExtension!;
        switch (operation) {
          case 'getActivityOptions':
            succeed(port, requestId, operation, activities);
            return;
          case 'getCurrentAccount':
            succeed(port, requestId, operation, { id: '7', name: 'Ada' });
            return;
          case 'fetchTimeLogs':
            succeed(port, requestId, operation, timeLogs);
            return;
          case 'fetchTimeLogsInRange':
            succeed(port, requestId, operation, timeLogsInRange);
            return;
          case 'listProjects':
            succeed(port, requestId, operation, projects);
            return;
          case 'searchIssues':
            succeed(port, requestId, operation, []);
            return;
          case 'getIssueById':
            succeed(port, requestId, operation, null);
            return;
          case 'deleteTimeEntry':
            succeed(port, requestId, operation, { status: 'deleted' });
            return;
          case 'createTimeEntry':
            state.creates += 1;
            succeed(port, requestId, operation, { remoteLogId: `fake-${state.creates}` });
            return;
          default:
            return;
        }
      }

      async function handlePortMessage(
        port: MessagePort,
        payload: {
          type?: string;
          requestId?: string;
          operation?: string;
          baseUrl?: string;
          secret?: string;
        },
      ): Promise<void> {
        const requestId = payload.requestId;
        const operation = payload.operation;
        const secret = payload.secret;
        console.log('[DBG fake-ext] handlePortMessage entered', JSON.stringify(payload));
        if (payload.type === 'handshake') {
          port.postMessage({
            type: 'handshake-result',
            protocolVersion,
            supportedOperations: operations,
            destinationApproved: true,
          });
          console.log('[DBG fake-ext] handshake-result sent');
          return;
        }
        if (payload.type !== 'operation' || !requestId || !operation) return;

        const state = window.__osiFakeExtension!;
        // Mirror the worker's own check-then-admit ordering exactly (REQ-310/331).
        if (active >= limit) {
          state.limitErrors += 1;
          port.postMessage({
            type: 'operation-result',
            requestId,
            operation,
            ok: false,
            error: { kind: 'limit', messageKey: 'error.extensionLimitExceeded' },
          });
          return;
        }
        active += 1;
        state.maxConcurrent = Math.max(state.maxConcurrent, active);
        if (secret) state.seenSecrets.push(secret);
        try {
          if (responseDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, responseDelayMs));
          }
          state.operationCounts[operation] = (state.operationCounts[operation] ?? 0) + 1;
          respond(port, requestId, operation);
        } finally {
          active -= 1;
        }
      }
    },
    {
      channel: CHANNEL,
      protocolVersion: PROTOCOL_VERSION,
      operations: [...SUPPORTED_OPERATIONS],
      activities: options.activities ?? [{ id: '1', name: 'Development' }],
      limit: options.limit ?? EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument,
      responseDelayMs: options.responseDelayMs ?? 20,
      timeLogs: options.timeLogs ?? [],
      timeLogsInRange: options.timeLogsInRange ?? [],
      projects: options.projects ?? [],
    },
  );
}
