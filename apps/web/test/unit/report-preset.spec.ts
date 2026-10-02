import { describe, expect, it } from 'vitest';
import type { ZodSafeParseResult } from 'zod';
import {
  REPORT_PRESET_CLIENT_NAME_MAX_LENGTH,
  REPORT_PRESET_MAX_TRACKERS,
  reportPresetInputSchema,
  type ReportPresetInput,
} from '../../shared/types/report-preset';

const trackerA = '01900000-0000-7000-8000-00000000000a';
const trackerB = '01900000-0000-7000-8000-00000000000b';

const valid = {
  clientName: 'Helios Energy',
  trackerIds: [trackerA, trackerB],
  hoursFormat: 'decimal',
  locale: 'pl',
};

/** The first issue message of a parse, which the API maps to `messageKey`. */
function messageKeyOf(result: ZodSafeParseResult<ReportPresetInput>): string | undefined {
  return result.success ? undefined : result.error.issues[0]?.message;
}

function trackerIds(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `01900000-0000-7000-8000-${String(index).padStart(12, '0')}`,
  );
}

describe('reportPresetInputSchema', () => {
  it('accepts a valid preset and trims the client name', () => {
    expect(reportPresetInputSchema.parse({ ...valid, clientName: '  Helios Energy  ' })).toEqual(
      valid,
    );
  });

  it('rejects a blank or oversized client name', () => {
    expect(messageKeyOf(reportPresetInputSchema.safeParse({ ...valid, clientName: '   ' }))).toBe(
      'error.reportPresetClientNameRequired',
    );
    expect(
      messageKeyOf(reportPresetInputSchema.safeParse({ ...valid, clientName: undefined })),
    ).toBe('error.reportPresetClientNameRequired');
    expect(
      messageKeyOf(
        reportPresetInputSchema.safeParse({
          ...valid,
          clientName: 'a'.repeat(REPORT_PRESET_CLIENT_NAME_MAX_LENGTH + 1),
        }),
      ),
    ).toBe('error.reportPresetClientNameTooLong');
    expect(
      messageKeyOf(
        reportPresetInputSchema.safeParse({
          ...valid,
          clientName: 'a'.repeat(REPORT_PRESET_CLIENT_NAME_MAX_LENGTH),
        }),
      ),
    ).toBeUndefined();
  });

  it('rejects empty, duplicate, too many, and malformed tracker ids', () => {
    expect(messageKeyOf(reportPresetInputSchema.safeParse({ ...valid, trackerIds: [] }))).toBe(
      'error.reportPresetTrackersRequired',
    );
    expect(
      messageKeyOf(
        reportPresetInputSchema.safeParse({ ...valid, trackerIds: [trackerA, trackerA] }),
      ),
    ).toBe('error.reportPresetTrackersDuplicate');
    expect(
      messageKeyOf(
        reportPresetInputSchema.safeParse({
          ...valid,
          trackerIds: trackerIds(REPORT_PRESET_MAX_TRACKERS + 1),
        }),
      ),
    ).toBe('error.reportPresetTrackersTooMany');
    expect(
      messageKeyOf(
        reportPresetInputSchema.safeParse({
          ...valid,
          trackerIds: trackerIds(REPORT_PRESET_MAX_TRACKERS),
        }),
      ),
    ).toBe(undefined);
    expect(
      messageKeyOf(reportPresetInputSchema.safeParse({ ...valid, trackerIds: ['nope'] })),
    ).toBe('error.reportPresetTrackerInvalid');
  });

  it('rejects unknown hours formats and locales', () => {
    expect(
      messageKeyOf(reportPresetInputSchema.safeParse({ ...valid, hoursFormat: 'minutes' })),
    ).toBe('error.reportPresetHoursFormatInvalid');
    expect(messageKeyOf(reportPresetInputSchema.safeParse({ ...valid, locale: 'de' }))).toBe(
      'error.reportPresetLocaleInvalid',
    );
  });
});
