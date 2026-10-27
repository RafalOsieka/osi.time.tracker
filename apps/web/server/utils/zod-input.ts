import { createError, getQuery, readBody, type RequestEvent } from 'nuxt/server';
import { ZodError, type ZodType } from 'zod';
import type { ApiMessage } from '../types/api-message';
import { mapZodError } from './zod-error';

/**
 * Reads and validates the request body with a zod schema in one step.
 * Zod failures become the project's `{ messageKey, params }` 422 (or `status`).
 *
 * Parses after `readBody` rather than `readValidatedBody`, which answers validator
 * failures with a generic HTTP 400 and would drop the `{ messageKey, params }` contract.
 */
export async function readZodBody<T>(
  event: RequestEvent,
  schema: ZodType<T>,
  status = 422,
): Promise<T> {
  const body = await readBody(event);
  try {
    return schema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        status,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }
}

/**
 * Reads and validates the query string with a zod schema in one step.
 */
export async function getZodQuery<T>(
  event: RequestEvent,
  schema: ZodType<T>,
  status = 422,
): Promise<T> {
  const query = getQuery(event);
  try {
    return schema.parse(query);
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        status,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }
}
