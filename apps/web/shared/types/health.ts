import { z } from 'zod';

/** What `GET /healthz` answers while the database responds. */
export const healthSchema = z.object({
  commit: z.string(),
});

export type HealthDto = z.infer<typeof healthSchema>;
