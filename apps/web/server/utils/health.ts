import { createError } from 'nuxt/server';
import type { HealthDto } from '../../shared/types/health';
import type { ApiMessage } from '../types/api-message';

/**
 * Reports the running build once `pingDatabase` resolves, and a 503 when it rejects
 * (platform-docker REQ-529). The ping is a parameter so the failure path needs no database.
 */
export async function readHealth(
  pingDatabase: () => Promise<void>,
  commit: string,
): Promise<HealthDto> {
  try {
    await pingDatabase();
  } catch {
    throw createError({
      status: 503,
      data: { messageKey: 'error.databaseUnavailable' } satisfies ApiMessage,
    });
  }
  return { commit };
}
