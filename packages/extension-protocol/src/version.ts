/** Exact protocol version required by both ends of the v1 bridge. */
export const EXTENSION_PROTOCOL_VERSION = 1 as const;

/** Discriminator for same-window page/content `postMessage` envelopes. */
export const EXTENSION_CHANNEL = 'osi-extension-protocol' as const;
