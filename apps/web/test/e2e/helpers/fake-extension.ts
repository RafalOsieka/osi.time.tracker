import type { Page } from 'playwright-core';

const CHANNEL = 'osi-extension-protocol';
const PROTOCOL_VERSION = 1;
const SUPPORTED_OPERATIONS = [
  'searchIssues',
  'getIssueById',
  'getActivityOptions',
  'getCurrentAccount',
  'fetchTimeLogs',
  'fetchTimeLogsInRange',
  'createTimeEntry',
] as const;

export interface FakeExtensionState {
  creates: number;
  seenSecrets: string[];
}

declare global {
  interface Window {
    __osiFakeExtension?: FakeExtensionState;
  }
}

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
      window.__osiFakeExtension = { creates: 0, seenSecrets: [] };
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
        result: { id: string; name: string }[] | { id: string; name: string } | null,
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
  return page.evaluate(() => window.__osiFakeExtension ?? { creates: 0, seenSecrets: [] });
}
