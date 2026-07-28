import { z } from 'zod';
import type { UserSettingsDto } from './user-settings';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  settings: UserSettingsDto;
}

export const loginSchema = z.object({
  email: z
    .string({
        error: (issue) => issue.input === undefined ? 'errors.auth.credentialsRequired' : 'errors.auth.credentialsRequired'
    })
    .trim()
    .min(1, {
        error: 'errors.auth.credentialsRequired'
    }),
  password: z
    .string({
        error: (issue) => issue.input === undefined ? 'errors.auth.credentialsRequired' : 'errors.auth.credentialsRequired'
    })
    .min(1, {
        error: 'errors.auth.credentialsRequired'
    }),
});

export type LoginDto = z.infer<typeof loginSchema>;
