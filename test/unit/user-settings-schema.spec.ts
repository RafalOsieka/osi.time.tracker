import { describe, expect, it } from 'vitest';
import { userSettingsSchema } from '../../shared/types/user-settings';

describe('userSettingsSchema', () => {
  it('accepts a supported timezone and week start', () => {
    expect(userSettingsSchema.parse({ timezone: 'Europe/Warsaw', weekStart: 'sunday' })).toEqual({
      timezone: 'Europe/Warsaw',
      weekStart: 'sunday',
    });
  });

  it('accepts a partial update', () => {
    expect(userSettingsSchema.parse({ weekStart: 'monday' })).toEqual({ weekStart: 'monday' });
  });

  it('accepts an explicitly cleared timezone', () => {
    expect(userSettingsSchema.parse({ timezone: null })).toEqual({ timezone: null });
  });

  it('rejects unsupported timezone and week start values', () => {
    expect(userSettingsSchema.safeParse({ timezone: 'Not/A_Timezone' }).success).toBe(false);
    expect(userSettingsSchema.safeParse({ weekStart: 'friday' }).success).toBe(false);
  });
});
