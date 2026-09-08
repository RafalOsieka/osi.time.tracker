import {
  EXTENSION_ERROR_MESSAGE_KEYS,
  ExtensionProtocolError,
  type DestinationSelector,
  type HandshakeResult,
} from '@osi/extension-protocol';
import {
  ExtensionDocumentBridge,
  type ExtensionBridgeOptions,
  type ExtensionWindow,
} from './extension-bridge';

export type ExtensionAvailabilityStatus =
  | 'available'
  | 'unavailable'
  | 'incompatible'
  | 'permission';

export interface ExtensionAvailability {
  status: ExtensionAvailabilityStatus;
  messageKey: string;
  handshake?: HandshakeResult;
}

/** Short handshake wait for setup/recheck; operations keep the protocol page deadline. */
export const EXTENSION_PROBE_TIMEOUT_MS = 2_000;

export interface ExtensionAvailabilityOptions {
  destination?: DestinationSelector;
  isClient?: boolean;
  openBridge?: (options?: Partial<ExtensionBridgeOptions>) => ExtensionDocumentBridge;
  bridgeOptions?: Partial<ExtensionBridgeOptions>;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.postMessage === 'function';
}

function unavailable(): ExtensionAvailability {
  return {
    status: 'unavailable',
    messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable,
  };
}

function fromProtocolError(error: ExtensionProtocolError): ExtensionAvailability {
  if (error.kind === 'incompatible') {
    return { status: 'incompatible', messageKey: error.messageKey };
  }
  if (error.kind === 'permission') {
    return { status: 'permission', messageKey: error.messageKey };
  }
  return { status: 'unavailable', messageKey: error.messageKey };
}

export function openExtensionBridge(
  options: Partial<ExtensionBridgeOptions> = {},
): ExtensionDocumentBridge {
  const windowRef: ExtensionWindow | undefined =
    options.window ?? (typeof window === 'undefined' ? undefined : window);
  if (!windowRef) {
    throw new ExtensionProtocolError('unavailable', EXTENSION_ERROR_MESSAGE_KEYS.unavailable);
  }
  return new ExtensionDocumentBridge({ ...options, window: windowRef });
}

/**
 * Credential-free extension probe. Never starts on SSR and never sends a secret.
 */
export async function probeExtensionAvailability(
  options: ExtensionAvailabilityOptions = {},
): Promise<ExtensionAvailability> {
  const isClient = options.isClient ?? isBrowser();
  if (!isClient) return unavailable();

  let bridge: ExtensionDocumentBridge | undefined;
  try {
    bridge = (options.openBridge ?? openExtensionBridge)({
      handshakeTimeoutMs: EXTENSION_PROBE_TIMEOUT_MS,
      ...options.bridgeOptions,
    });
    const handshake = await bridge.handshake(options.destination);
    if (options.destination && handshake.destinationApproved === false) {
      return {
        status: 'permission',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.destinationUnapproved,
        handshake,
      };
    }
    return {
      status: 'available',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable,
      handshake,
    };
  } catch (error) {
    if (error instanceof ExtensionProtocolError) return fromProtocolError(error);
    return unavailable();
  } finally {
    bridge?.close();
  }
}
