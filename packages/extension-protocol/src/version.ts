/**
 * Exact protocol version required by both ends of the bridge. v2 (REQ-379):
 * time logs carry a required, nullable `remoteIssueTitle`, so an extension
 * built for v1 fails the handshake instead of a time-log result validation.
 * v3 (REQ-422): the bridge carries destination suggestions, so a v2 extension
 * fails the handshake instead of rejecting the first suggestion.
 */
export const EXTENSION_PROTOCOL_VERSION = 3 as const;

/** Discriminator for same-window page/content `postMessage` envelopes. */
export const EXTENSION_CHANNEL = 'osi-extension-protocol' as const;
