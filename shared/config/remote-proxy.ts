/**
 * Request header carrying the browser-held tracker API secret for
 * `proxied`-transport remote issue search. The server reads it only to
 * authorize the single upstream call: it is never persisted, logged, or
 * echoed back (REQ-TTR-112).
 */
export const REMOTE_PROXY_SECRET_HEADER = 'x-remote-proxy-secret';
