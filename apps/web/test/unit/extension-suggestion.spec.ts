import { describe, expect, it, vi } from 'vitest';
import {
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_OPERATION_NAMES,
  EXTENSION_PROTOCOL_VERSION,
  handshakeRequestSchema,
  suggestDestinationRequestSchema,
  type SuggestDestinationResult,
} from '@osi/extension-protocol';
import type { JsonValue } from '@osi/remote-trackers/contracts';
import type {
  ExtensionChannel,
  ExtensionMessagePort,
  ExtensionWindow,
} from '../../app/utils/remote/extension-bridge';
import { ExtensionDocumentBridge } from '../../app/utils/remote/extension-bridge';
import { suggestExtensionDestination } from '../../app/utils/remote/extension-suggestion';
import { useExtensionSuggestion } from '../../app/composables/use-extension-suggestion';

type Listener = (event: { data: JsonValue }) => void;

/**
 * A page bridge wired to a fake extension: `answer` maps each message the page sends to the
 * extension's reply (or no reply).
 */
function bridgeTo(answer: (message: JsonValue) => JsonValue | undefined) {
  const pageListeners = new Set<Listener>();
  const port1: ExtensionMessagePort = {
    start() {},
    close() {
      pageListeners.clear();
    },
    postMessage(message) {
      const reply = answer(structuredClone(message));
      if (reply !== undefined) {
        queueMicrotask(() => {
          for (const listener of [...pageListeners]) listener({ data: reply });
        });
      }
    },
    addEventListener(_type, listener) {
      pageListeners.add(listener);
    },
    removeEventListener(_type, listener) {
      pageListeners.delete(listener);
    },
  };
  const unused: ExtensionMessagePort = {
    close() {},
    postMessage() {},
    addEventListener() {},
    removeEventListener() {},
  };
  const channel: ExtensionChannel = { port1, port2: unused };
  const window: ExtensionWindow = {
    location: { origin: 'https://time.example.com' },
    postMessage() {},
  };
  return () => new ExtensionDocumentBridge({ window, createChannel: () => channel });
}

const handshakeResult = {
  type: 'handshake-result',
  protocolVersion: EXTENSION_PROTOCOL_VERSION,
  supportedOperations: [...EXTENSION_OPERATION_NAMES],
};

function extensionAnswering(result: (requestId: string) => SuggestDestinationResult) {
  return bridgeTo((message) => {
    if (handshakeRequestSchema.safeParse(message).success) return handshakeResult;
    const suggestion = suggestDestinationRequestSchema.safeParse(message);
    return suggestion.success ? result(suggestion.data.requestId) : undefined;
  });
}

const destination = { provider: 'redmine' as const, baseUrl: 'https://rm.example.com' };

describe('extension destination suggestions', () => {
  it.each(['queued', 'alreadyApproved'] as const)(
    'reports %s from the extension',
    async (status) => {
      const openBridge = extensionAnswering((requestId) => ({
        type: 'suggest-destination-result',
        requestId,
        ok: true,
        status,
      }));
      expect(await suggestExtensionDestination(destination, { openBridge })).toEqual({ status });
    },
  );

  it('reports a rejected suggestion with the extension message key', async () => {
    const openBridge = extensionAnswering((requestId) => ({
      type: 'suggest-destination-result',
      requestId,
      ok: false,
      error: { kind: 'limit', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.limit },
    }));
    expect(await suggestExtensionDestination(destination, { openBridge })).toEqual({
      status: 'failed',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.limit,
    });
  });

  it('reports an extension on another protocol version as incompatible', async () => {
    const sent: JsonValue[] = [];
    const openBridge = bridgeTo((message) => {
      sent.push(message);
      return { kind: 'incompatible', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.incompatible };
    });
    expect(await suggestExtensionDestination(destination, { openBridge })).toEqual({
      status: 'failed',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.incompatible,
    });
    expect(sent).toContainEqual({ type: 'handshake', protocolVersion: EXTENSION_PROTOCOL_VERSION });
    expect(sent).not.toContainEqual(expect.objectContaining({ type: 'suggest-destination' }));
  });

  it('rechecks readiness instead of showing a message when already approved', async () => {
    const recheck = vi.fn();
    const { states, request } = useExtensionSuggestion(recheck, async () => ({
      status: 'alreadyApproved',
    }));
    await request(destination);
    expect(recheck).toHaveBeenCalledOnce();
    expect(states.value).toEqual({});
  });

  it('keeps the queued or failed outcome per tracker', async () => {
    const { states, request } = useExtensionSuggestion(vi.fn(), async (target) =>
      target.baseUrl.includes('rm')
        ? { status: 'queued' }
        : { status: 'failed', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable },
    );
    await request(destination);
    await request({ provider: 'openproject', baseUrl: 'https://op.example.com' });
    expect(states.value).toEqual({
      'redmine|https://rm.example.com': { status: 'queued' },
      'openproject|https://op.example.com': {
        status: 'failed',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable,
      },
    });
  });
});
