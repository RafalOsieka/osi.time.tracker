import { z } from 'zod';

export const calendarMonthSchema = z
  .string({ error: 'error.reportMonthInvalid' })
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'error.reportMonthInvalid' });

export const monthlyReportQuerySchema = z.object({
  month: calendarMonthSchema.optional(),
});

export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;

export interface MonthlyReportTrackerDto {
  id: string;
  name: string;
}

export interface MonthlyReportDayDto {
  date: string;
  localSeconds: number;
}

export interface MonthlyReportExportDto {
  localDate: string;
  remoteLogId: string;
  exportDurationSeconds: number;
}

export interface MonthlyReportDto {
  month: string;
  timezone: string;
  trackers: MonthlyReportTrackerDto[];
  days: MonthlyReportDayDto[];
  exports: MonthlyReportExportDto[];
}
