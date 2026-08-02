import { z } from 'zod';

export type WeekStart = 'monday' | 'sunday';

const supportedTimeZones = new Set(Intl.supportedValuesOf('timeZone'));

export const userSettingsSchema = z.object({
  timezone: z
    .string({ error: 'errors.userSettings.invalidTimezone' })
    .refine((value) => supportedTimeZones.has(value), {
      error: 'errors.userSettings.invalidTimezone',
    })
    .nullable()
    .optional(),
  weekStart: z
    .enum(['monday', 'sunday'], {
      error: 'errors.userSettings.invalidWeekStart',
    })
    .optional(),
});

export interface UserSettingsDto {
  timezone: string | null;
  weekStart: WeekStart;
}

export type UpdateUserSettingsDto = z.infer<typeof userSettingsSchema>;
