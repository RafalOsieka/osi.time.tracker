import { describe, expect, it } from 'vitest';
import { userSettingsSchema } from '../../shared/types/user-settings';

describe('userSettingsSchema', () => {
  it('accepts a valid timezone', () => {
    expect(userSettingsSchema.parse({ timezone: 'Europe/Warsaw' })).toEqual({
      timezone: 'Europe/Warsaw',
    });
  });

  it('accepts null timezone', () => {
    expect(userSettingsSchema.parse({ timezone: null })).toEqual({ timezone: null });
  });

  it('rejects an unknown timezone', () => {
    expect(userSettingsSchema.safeParse({ timezone: 'Not/AZone' }).success).toBe(false);
  });

  it('strips unknown weekStart field', () => {
    const parsed = userSettingsSchema.parse({
      timezone: 'Europe/Warsaw',
      weekStart: 'sunday',
    });
    expect(parsed).toEqual({ timezone: 'Europe/Warsaw' });
    expect(parsed).not.toHaveProperty('weekStart');
  });
});
