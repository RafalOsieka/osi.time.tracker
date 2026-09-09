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
  | 'websiteUnapproved'
  | 'permission';

export interface ExtensionAvailability {
  status: ExtensionAvailabilityStatus;
  messageKey: string;
  handshake?: HandshakeResult;
  websiteApproved?: boolean;
  destinationApproved?: boolean;
}

/** Short handshake wait for setup/recheck; operations keep the protocol page deadline. */
export const EXTENSION_PROBE_TIMEOUT_MS = 2_000;

export interface ExtensionAvailabilityOptions {
  destination?: DestinationSelector;
  isClient?: boolean;
  openBridge?: (options?: Partial<ExtensionBridgeOptions>) => ExtensionDocumentBridge;
  bridgeOptions?: Partial<ExtensionBridgeOptions>;
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
    if (error.messageKey === EXTENSION_ERROR_MESSAGE_KEYS.originUnapproved) {
      return {
        status: 'websiteUnapproved',
        messageKey: error.messageKey,
        websiteApproved: false,
      };
    }
    return {
      status: 'permission',
      messageKey: error.messageKey,
      websiteApproved: true,
      destinationApproved: false,
    };
  }
  return { status: 'unavailable', messageKey: error.messageKey };
}

export function openExtensionBridge(
  options: Partial<ExtensionBridgeOptions> = {},
): ExtensionDocumentBridge {
  const windowRef: ExtensionWindow | undefined =
    options.window ?? (import.meta.client ? window : undefined);
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
  const isClient = options.isClient ?? import.meta.client;
  if (!isClient) return unavailable();

  let bridge: ExtensionDocumentBridge | undefined;
  try {
    bridge = (options.openBridge ?? openExtensionBridge)({
      handshakeTimeoutMs: EXTENSION_PROBE_TIMEOUT_MS,
      ...options.bridgeOptions,
    });
    const handshake = await bridge.handshake(options.destination);
    if (options.destination && handshake.destinationApproved !== true) {
      return {
        status: 'permission',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.destinationUnapproved,
        handshake,
        websiteApproved: true,
        destinationApproved: false,
      };
    }
    return {
      status: 'available',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable,
      handshake,
      websiteApproved: true,
      destinationApproved: options.destination ? true : handshake.destinationApproved,
    };
  } catch (error) {
    if (error instanceof ExtensionProtocolError) return fromProtocolError(error);
    return unavailable();
  } finally {
    bridge?.close();
  }
}
