import { z } from 'zod';

const supportedTimeZones = new Set(Intl.supportedValuesOf('timeZone'));

export const userSettingsSchema = z.object({
  timezone: z
    .string({ error: 'errors.userSettings.invalidTimezone' })
    .refine((value) => supportedTimeZones.has(value), {
      error: 'errors.userSettings.invalidTimezone',
    })
    .nullable()
    .optional(),
});

export interface UserSettingsDto {
  timezone: string | null;
}

export type UpdateUserSettingsDto = z.infer<typeof userSettingsSchema>;
