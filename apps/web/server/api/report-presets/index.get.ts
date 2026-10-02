import type { ReportPresetDto } from '../../../shared/types/report-preset';
import { getDb } from '../../db/index';
import { listReportPresets } from '../../utils/report-presets';

export default defineEventHandler(async (event): Promise<ReportPresetDto[]> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  return listReportPresets(db, user.id);
});
