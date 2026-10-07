import { z } from 'zod';
import type { ProfileDto } from './profile';

/** The session user (core-authentication REQ-424): identity plus the required profile. */
export type AuthUser = { id: string; email: string } & ProfileDto;

export const loginSchema = z.object({
  email: z
    .string({ error: 'errors.auth.credentialsRequired' })
    .trim()
    .min(1, { error: 'errors.auth.credentialsRequired' }),
  password: z
    .string({ error: 'errors.auth.credentialsRequired' })
    .min(1, { error: 'errors.auth.credentialsRequired' }),
});

export type LoginDto = z.infer<typeof loginSchema>;
