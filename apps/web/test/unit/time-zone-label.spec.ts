import { describe, expect, it } from 'vitest';
import { timeZoneLabel } from '../../app/utils/time-zone-label';

describe('timeZoneLabel', () => {
  it('names the zone with the offset in force at the instant', () => {
    expect(timeZoneLabel('Europe/Warsaw', '2026-11-07T09:00:00Z')).toBe(
      'Europe/Warsaw (UTC+01:00)',
    );
    expect(timeZoneLabel('Europe/Warsaw', '2026-07-07T09:00:00Z')).toBe(
      'Europe/Warsaw (UTC+02:00)',
    );
    expect(timeZoneLabel('America/Los_Angeles', '2026-11-07T09:00:00Z')).toBe(
      'America/Los_Angeles (UTC-08:00)',
    );
  });

  it('shows plain UTC without an offset', () => {
    expect(timeZoneLabel('UTC', '2026-11-07T09:00:00Z')).toBe('UTC');
  });
});
