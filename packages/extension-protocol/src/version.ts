/**
 * Exact protocol version required by both ends of the bridge. v2 (REQ-379):
 * time logs carry a required, nullable `remoteIssueTitle`, so an extension
 * built for v1 fails the handshake instead of a time-log result validation.
 */
export const EXTENSION_PROTOCOL_VERSION = 2 as const;

/** Discriminator for same-window page/content `postMessage` envelopes. */
export const EXTENSION_CHANNEL = 'osi-extension-protocol' as const;
