import type { H3Event } from 'h3';
import { ZodError, type ZodType } from 'zod';
import type { ApiMessage } from '../types/api-message';
import { mapZodError } from './zod-error';

/**
 * Reads and validates the request body with a zod schema in one step.
 * Zod failures become the project's `{ messageKey, params }` 422 (or `statusCode`).
 *
 * Parses after `readBody` rather than `readValidatedBody`, which wraps validator
 * throws as a generic HTTP 400 and would drop the `{ messageKey, params }` contract.
 */
export async function readZodBody<T>(
  event: H3Event,
  schema: ZodType<T>,
  statusCode = 422,
): Promise<T> {
  const body = await readBody(event);
  try {
    return schema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode,
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
  event: H3Event,
  schema: ZodType<T>,
  statusCode = 422,
): Promise<T> {
  const query = getQuery(event);
  try {
    return schema.parse(query);
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }
}
