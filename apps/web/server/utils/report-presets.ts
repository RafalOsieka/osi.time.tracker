import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { getDb } from '../db/index';
import { reportPresets, reportPresetTrackers, trackers } from '../db/schema';
import type { ReportPresetDto, ReportPresetInput } from '../../shared/types/report-preset';
import type { ApiMessage } from '../types/api-message';
import { isUniqueViolation } from './is-unique-violation';

type Db = ReturnType<typeof getDb>;

/**
 * Lists a user's report presets in REQ-381 shape: most recently used first,
 * never-used last (newest first), active trackers in stored order plus the
 * count of trackers soft-deleted since. `presetId` narrows to one preset.
 */
export async function listReportPresets(
  db: Db,
  userId: string,
  presetId?: string,
): Promise<ReportPresetDto[]> {
  const presets = await db
    .select()
    .from(reportPresets)
    .where(
      and(eq(reportPresets.userId, userId), presetId ? eq(reportPresets.id, presetId) : undefined),
    )
    .orderBy(
      sql`${reportPresets.lastUsedAt} desc nulls last`,
      sql`${reportPresets.createdAt} desc`,
    );
  if (presets.length === 0) return [];

  const trackerRows = await db
    .select({
      presetId: reportPresetTrackers.presetId,
      id: trackers.id,
      name: trackers.name,
      deletedAt: trackers.deletedAt,
    })
    .from(reportPresetTrackers)
    .innerJoin(trackers, eq(trackers.id, reportPresetTrackers.trackerId))
    .where(
      inArray(
        reportPresetTrackers.presetId,
        presets.map((preset) => preset.id),
      ),
    )
    .orderBy(asc(reportPresetTrackers.position));

  return presets.map((preset) => {
    const rows = trackerRows.filter((row) => row.presetId === preset.id);
    return {
      id: preset.id,
      clientName: preset.clientName,
      trackers: rows
        .filter((row) => row.deletedAt === null)
        .map((row) => ({ id: row.id, name: row.name })),
      inactiveTrackerCount: rows.filter((row) => row.deletedAt !== null).length,
      hoursFormat: preset.hoursFormat,
      locale: preset.locale,
      lastUsedAt: preset.lastUsedAt?.toISOString() ?? null,
      createdAt: preset.createdAt.toISOString(),
      updatedAt: preset.updatedAt.toISOString(),
    };
  });
}

/**
 * Creates (`presetId` null) or replaces a user's preset (REQ-382): checks
 * every tracker is the user's and active, writes the preset and its ordered
 * tracker rows in one transaction, and marks it as used now.
 */
export async function saveReportPreset(
  db: Db,
  userId: string,
  input: ReportPresetInput,
  presetId: string | null,
): Promise<ReportPresetDto> {
  if (presetId) {
    const [existing] = await db
      .select({ id: reportPresets.id })
      .from(reportPresets)
      .where(and(eq(reportPresets.id, presetId), eq(reportPresets.userId, userId)))
      .limit(1);
    if (!existing) {
      throw createError({
        statusCode: 404,
        data: { messageKey: 'error.notFound' } satisfies ApiMessage,
      });
    }
  }

  const ownedTrackers = await db
    .select({ id: trackers.id })
    .from(trackers)
    .where(
      and(
        inArray(trackers.id, input.trackerIds),
        eq(trackers.userId, userId),
        isNull(trackers.deletedAt),
      ),
    );
  // One key for foreign, unknown, and deleted ids so ownership is not revealed.
  if (ownedTrackers.length !== input.trackerIds.length) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.reportPresetTrackerInvalid' } satisfies ApiMessage,
    });
  }

  const now = new Date();
  const values = {
    clientName: input.clientName,
    hoursFormat: input.hoursFormat,
    locale: input.locale,
    lastUsedAt: now,
    updatedAt: now,
  };

  let savedId: string;
  try {
    savedId = await db.transaction(async (tx) => {
      const [saved] = presetId
        ? await tx
            .update(reportPresets)
            .set(values)
            .where(and(eq(reportPresets.id, presetId), eq(reportPresets.userId, userId)))
            .returning({ id: reportPresets.id })
        : await tx
            .insert(reportPresets)
            .values({ ...values, userId })
            .returning({ id: reportPresets.id });
      if (!saved) {
        throw createError({
          statusCode: 404,
          data: { messageKey: 'error.notFound' } satisfies ApiMessage,
        });
      }

      await tx.delete(reportPresetTrackers).where(eq(reportPresetTrackers.presetId, saved.id));
      await tx.insert(reportPresetTrackers).values(
        input.trackerIds.map((trackerId, position) => ({
          presetId: saved.id,
          trackerId,
          position,
        })),
      );
      return saved.id;
    });
  } catch (err) {
    if (err instanceof Error && isUniqueViolation(err)) {
      throw createError({
        statusCode: 409,
        data: { messageKey: 'error.reportPresetClientNameDuplicate' } satisfies ApiMessage,
      });
    }
    throw err;
  }

  const [dto] = await listReportPresets(db, userId, savedId);
  if (!dto) {
    throw createError({
      statusCode: 500,
      data: { messageKey: 'error.unknown' } satisfies ApiMessage,
    });
  }
  return dto;
}
