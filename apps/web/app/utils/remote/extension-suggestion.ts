import { ExtensionProtocolError, type DestinationSelector } from '@osi/extension-protocol';
import {
  EXTENSION_PROBE_TIMEOUT_MS,
  openExtensionBridge,
  type ExtensionAvailabilityOptions,
} from './extension-availability';

export type ExtensionSuggestionOutcome =
  | { status: 'queued' }
  | { status: 'alreadyApproved' }
  | { status: 'failed'; messageKey: string };

/**
 * Asks the extension to queue this tracker for the user's approval. Handshakes first, so an
 * extension on another protocol version reports the incompatibility instead of a bad message.
 */
export async function suggestExtensionDestination(
  destination: DestinationSelector,
  options: Pick<ExtensionAvailabilityOptions, 'openBridge' | 'bridgeOptions'> = {},
): Promise<ExtensionSuggestionOutcome> {
  let bridge: ReturnType<typeof openExtensionBridge> | undefined;
  try {
    bridge = (options.openBridge ?? openExtensionBridge)({
      handshakeTimeoutMs: EXTENSION_PROBE_TIMEOUT_MS,
      ...options.bridgeOptions,
    });
    await bridge.handshake();
    return { status: await bridge.suggestDestination(destination) };
  } catch (error) {
    if (error instanceof ExtensionProtocolError) {
      return { status: 'failed', messageKey: error.messageKey };
    }
    return { status: 'failed', messageKey: 'error.extensionUnavailable' };
  } finally {
    bridge?.close();
  }
}
