import { z } from 'zod';

export type WeekStart = 'monday' | 'sunday';

const supportedTimeZones = new Set(Intl.supportedValuesOf('timeZone'));

export const userSettingsSchema = z.object({
  timezone: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'errors.userSettings.invalidTimezone'
    })
    .refine((value) => supportedTimeZones.has(value), {
        error: 'errors.userSettings.invalidTimezone'
    })
    .nullable()
    .optional(),
  weekStart: z
    .enum(['monday', 'sunday'], {
        error: (issue) => issue.input === undefined ? 'errors.userSettings.invalidWeekStart' : 'errors.userSettings.invalidWeekStart'
    })
    .optional(),
});

export interface UserSettingsDto {
  timezone: string | null;
  weekStart: WeekStart;
}

export type UpdateUserSettingsDto = z.infer<typeof userSettingsSchema>;
