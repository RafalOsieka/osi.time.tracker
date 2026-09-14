import { z } from 'zod';
import type { H3Error } from 'h3';

/** One formatted request-error log line, ready to hand to a `consola` call. */
export interface RequestErrorLogEntry {
  level: 'warn' | 'error';
  message: string;
  /** Present for 5xx errors so the caller can log the stack/cause alongside the message. */
  error?: H3Error;
}

const MESSAGE_KEY_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9_]+)+$/i;

/**
 * Narrows an error's `data` (typed `unknown` on `H3Error<DataT = unknown>`) to the
 * project's `{ messageKey, params }` contract (REQ-171) at this boundary. A `data`
 * that doesn't fully match -- including one with a non-primitive `params` value --
 * is rejected as a whole, so a future call site that accidentally attaches a
 * request body or other object as `data` can never leak part of it into the log
 * line (REQ-356); the caller falls back to a bare `[METHOD] path -> status` line.
 */
const apiMessageDataSchema = z.object({
  messageKey: z.string().regex(MESSAGE_KEY_PATTERN),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

/**
 * Formats one request-ending error for the server-logging error hook
 * (REQ-355). Returns `null` for an error already logged by h3/Nitro's own
 * `[unhandled]`/`[fatal]` output, so a thrown non-`H3Error` is never logged
 * twice. Only the method, path, status and — when present — the error's
 * `{ messageKey, params }` contract are ever included; the request body,
 * headers, cookies and session are never read here (REQ-356).
 */
export function describeRequestError(
  error: H3Error,
  context: { method: string; path: string },
): RequestErrorLogEntry | null {
  if (error.unhandled || error.fatal) {
    return null;
  }

  const statusCode = error.statusCode || 500;
  const parsedData = apiMessageDataSchema.safeParse(error.data);
  const suffix = parsedData.success
    ? ` ${parsedData.data.messageKey}${parsedData.data.params ? ` ${JSON.stringify(parsedData.data.params)}` : ''}`
    : '';
  const message = `[${context.method}] ${context.path} -> ${statusCode}${suffix}`;

  if (statusCode >= 500) {
    return { level: 'error', message, error };
  }

  return { level: 'warn', message };
}
