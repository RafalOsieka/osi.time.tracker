import { z } from 'zod';

export const CLIENT_NAME_MAX_LENGTH = 100;

export const createClientSchema = z.object({
  name: z
    .string({
      required_error: 'error.clientNameRequired',
      invalid_type_error: 'error.clientNameRequired',
    })
    .trim()
    .min(1, { message: 'error.clientNameRequired' })
    .max(CLIENT_NAME_MAX_LENGTH, { message: 'error.clientNameTooLong' }),
});

export type CreateClientDto = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema;

export type UpdateClientDto = z.infer<typeof updateClientSchema>;

export interface ClientDto {
  id: string;
  name: string;
  createdAt: string;
}
