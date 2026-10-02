import { z } from 'zod';

export const REPORT_PRESET_CLIENT_NAME_MAX_LENGTH = 120;
export const REPORT_PRESET_MAX_TRACKERS = 20;

/** `hm` prints unpadded `H:MM`; `decimal` prints hours with two decimals (REQ-387). */
export const reportHoursFormatSchema = z.enum(['hm', 'decimal'], {
  error: 'error.reportPresetHoursFormatInvalid',
});

export type ReportHoursFormat = z.infer<typeof reportHoursFormatSchema>;

/** Language of the generated PDF, independent of the UI locale (REQ-390). */
export const reportLocaleSchema = z.enum(['en', 'pl'], {
  error: 'error.reportPresetLocaleInvalid',
});

export type ReportLocale = z.infer<typeof reportLocaleSchema>;

/** Create and update body of a report preset (REQ-380); PATCH replaces every field. */
export const reportPresetInputSchema = z.object({
  clientName: z
    .string({ error: 'error.reportPresetClientNameRequired' })
    .trim()
    .min(1, { error: 'error.reportPresetClientNameRequired' })
    .max(REPORT_PRESET_CLIENT_NAME_MAX_LENGTH, { error: 'error.reportPresetClientNameTooLong' }),
  trackerIds: z
    .array(z.uuid({ error: 'error.reportPresetTrackerInvalid' }), {
      error: 'error.reportPresetTrackersRequired',
    })
    .min(1, { error: 'error.reportPresetTrackersRequired' })
    .max(REPORT_PRESET_MAX_TRACKERS, { error: 'error.reportPresetTrackersTooMany' })
    .refine((ids) => new Set(ids).size === ids.length, {
      error: 'error.reportPresetTrackersDuplicate',
    }),
  hoursFormat: reportHoursFormatSchema,
  locale: reportLocaleSchema,
});

export type ReportPresetInput = z.infer<typeof reportPresetInputSchema>;

/** A report preset as listed for its owner (REQ-381). */
export interface ReportPresetDto {
  id: string;
  clientName: string;
  /** Active trackers in stored order. */
  trackers: { id: string; name: string }[];
  /** Stored trackers that have since been soft-deleted. */
  inactiveTrackerCount: number;
  hoursFormat: ReportHoursFormat;
  locale: ReportLocale;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
