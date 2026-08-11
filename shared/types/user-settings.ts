import { z } from 'zod';

export const weekStartSchema = z.enum(['monday', 'sunday'], {
  error: 'errors.userSettings.invalidWeekStart',
});

export type WeekStart = z.infer<typeof weekStartSchema>;

/** Stable display order for week-start selects. */
export const WEEK_START_ORDER = ['monday', 'sunday'] as const satisfies readonly WeekStart[];

const supportedTimeZones = new Set(Intl.supportedValuesOf('timeZone'));

export const userSettingsSchema = z.object({
  timezone: z
    .string({ error: 'errors.userSettings.invalidTimezone' })
    .refine((value) => supportedTimeZones.has(value), {
      error: 'errors.userSettings.invalidTimezone',
    })
    .nullable()
    .optional(),
  weekStart: weekStartSchema.optional(),
});

export interface UserSettingsDto {
  timezone: string | null;
  weekStart: WeekStart;
}

export type UpdateUserSettingsDto = z.infer<typeof userSettingsSchema>;
