import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({
      required_error: 'errors.auth.credentialsRequired',
      invalid_type_error: 'errors.auth.credentialsRequired',
    })
    .trim()
    .min(1, { message: 'errors.auth.credentialsRequired' }),
  password: z
    .string({
      required_error: 'errors.auth.credentialsRequired',
      invalid_type_error: 'errors.auth.credentialsRequired',
    })
    .min(1, { message: 'errors.auth.credentialsRequired' }),
});

export type LoginDto = z.infer<typeof loginSchema>;
