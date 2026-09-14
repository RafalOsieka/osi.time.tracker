import { consola } from 'consola';
import type { H3Error } from 'h3';
import { ensureFiniteLogLevel } from '../utils/log-level';
import { describeRequestError } from '../utils/request-error-log';

/**
 * Logs every request that ends in an error response (server-logging REQ-355):
 * our own `createError`s, platform middleware rejections (e.g. rate limiting,
 * CSRF), and Nitro's own `[unhandled]`/`[fatal]` output stays the single
 * source for a raw thrown exception (never duplicated here). Only method,
 * path, status and `{ messageKey, params }` are logged -- never the request
 * body, headers, cookies or session (REQ-356).
 */
export default defineNitroPlugin((nitroApp) => {
  ensureFiniteLogLevel(consola);

  nitroApp.hooks.hook('error', (error, { event }) => {
    if (!event) {
      return;
    }

    // SAFETY: by the time the `error` hook fires, h3 has already normalized the
    // thrown value through `createError()` (see h3's `toNodeListener`), so every
    // error here carries the H3Error shape even though the hook types it as `Error`.
    const h3Error = error as H3Error;
    const path = event.path.split('?')[0] ?? event.path;
    const entry = describeRequestError(h3Error, { method: event.method, path });
    if (!entry) {
      return;
    }

    if (entry.level === 'error') {
      consola.error(entry.message, entry.error);
    } else {
      consola.warn(entry.message);
    }
  });
});
