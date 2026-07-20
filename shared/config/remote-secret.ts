/**
 * Request header carrying the browser-held tracker API secret for
 * `server`-execution-mode remote requests. The server reads it only to
 * authorize the single upstream call: it is never persisted, logged, or
 * echoed back (REQ-TTR-112).
 */
export const REMOTE_SECRET_HEADER = 'x-remote-secret';
