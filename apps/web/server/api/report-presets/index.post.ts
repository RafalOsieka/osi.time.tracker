import { reportPresetInputSchema } from '../../../shared/types/report-preset';
import type { ReportPresetDto } from '../../../shared/types/report-preset';
import { getDb } from '../../db/index';
import { saveReportPreset } from '../../utils/report-presets';
import { readZodBody } from '../../utils/zod-input';

export default defineEventHandler(async (event): Promise<ReportPresetDto> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const input = await readZodBody(event, reportPresetInputSchema);
  return saveReportPreset(db, user.id, input, null);
});
