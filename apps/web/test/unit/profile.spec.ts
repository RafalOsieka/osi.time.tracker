import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import type { JsonObject } from '@osi/remote-trackers/contracts';
import { profileSchema, TIME_ZONES } from '../../shared/types/profile';
import { mapZodError } from '../../server/utils/zod-error';

/** Maps a failed parse to the API error contract the client receives. */
function errorOf(body: JsonObject) {
  const result = profileSchema.safeParse(body);
  if (result.success) throw new Error('expected a validation error');
  return mapZodError(new ZodError(result.error.issues));
}

describe('profileSchema', () => {
  it('trims the display name and keeps a valid timezone', () => {
    expect(
      profileSchema.parse({ displayName: '  Jan Kowalski ', timezone: 'Europe/Warsaw' }),
    ).toEqual({ displayName: 'Jan Kowalski', timezone: 'Europe/Warsaw' });
  });

  it('accepts a partial update', () => {
    expect(profileSchema.parse({ timezone: 'Asia/Tokyo' })).toEqual({ timezone: 'Asia/Tokyo' });
  });

  it('accepts UTC although Intl does not list it', () => {
    expect(Intl.supportedValuesOf('timeZone')).not.toContain('UTC');
    expect(profileSchema.parse({ timezone: 'UTC' })).toEqual({ timezone: 'UTC' });
    expect(TIME_ZONES[0]).toBe('UTC');
  });

  it.each([{ displayName: '' }, { displayName: '   ' }])('rejects a blank display name', (body) => {
    expect(errorOf(body)).toEqual({
      messageKey: 'errors.profile.displayNameRequired',
      params: { min: 1 },
    });
  });

  it('rejects a display name over 100 characters with max', () => {
    expect(errorOf({ displayName: 'x'.repeat(101) })).toEqual({
      messageKey: 'errors.profile.displayNameTooLong',
      params: { max: 100 },
    });
  });

  it('rejects an unknown timezone', () => {
    expect(errorOf({ timezone: 'Mars/Olympus' }).messageKey).toBe('errors.profile.invalidTimezone');
  });

  it.each([{ displayName: null }, { timezone: null }])('rejects null fields', (body) => {
    expect(profileSchema.safeParse(body).success).toBe(false);
  });

  it('strips unknown keys such as weekStart', () => {
    const parsed = profileSchema.parse({ timezone: 'Europe/Warsaw', weekStart: 'sunday' });
    expect(parsed).toEqual({ timezone: 'Europe/Warsaw' });
  });
});
