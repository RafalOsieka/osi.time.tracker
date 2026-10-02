import { z } from 'zod';

/** Display name limit after trimming (workspace-settings REQ-397). */
export const DISPLAY_NAME_MAX_LENGTH = 100;

/**
 * Selectable timezones: `UTC` (the default for new and migrated users) followed by
 * Intl's canonical IANA zones, which do not list `UTC` themselves.
 */
export const TIME_ZONES: readonly string[] = ['UTC', ...Intl.supportedValuesOf('timeZone')];

const supportedTimeZones = new Set(TIME_ZONES);

export const displayNameSchema = z
  .string({ error: 'errors.profile.displayNameRequired' })
  .trim()
  .min(1, { error: 'errors.profile.displayNameRequired' })
  .max(DISPLAY_NAME_MAX_LENGTH, { error: 'errors.profile.displayNameTooLong' });

export const timezoneSchema = z
  .string({ error: 'errors.profile.invalidTimezone' })
  .refine((value) => supportedTimeZones.has(value), { error: 'errors.profile.invalidTimezone' });

/** Partial `PATCH /api/user/profile` body (REQ-399); unknown keys such as `weekStart` are stripped. */
export const profileSchema = z
  .object({ displayName: displayNameSchema, timezone: timezoneSchema })
  .partial();

export type UpdateProfileDto = z.infer<typeof profileSchema>;

/** The user's profile as returned by the profile API and carried in the session. */
export type ProfileDto = Required<UpdateProfileDto>;
