import type { H3Event } from 'h3';
import { ZodError, type ZodType } from 'zod';
import type { ApiMessage } from '../types/api-message';
import { mapZodError } from './zod-error';

/**
 * Reads and validates the request body with a zod schema in one step.
 * Zod failures become the project's `{ messageKey, params }` 422 (or `statusCode`).
 */
export async function readZodBody<T>(
  event: H3Event,
  schema: ZodType<T>,
  statusCode = 422,
): Promise<T> {
  try {
    return await readValidatedBody(event, (body) => schema.parse(body));
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
  try {
    return await getValidatedQuery(event, (query) => schema.parse(query));
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
