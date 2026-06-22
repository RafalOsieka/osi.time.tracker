/**
 * Represents a user-facing message returned by server API responses.
 * The server stays locale-agnostic: it returns a stable translation key
 * and optional interpolation params; the client translates via $t(messageKey, params).
 */
export interface ApiMessage {
  messageKey: string;
  params?: Record<string, unknown>;
}
