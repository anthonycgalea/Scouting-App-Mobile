import { getDbOrThrow, schema } from '@/db';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import type { PickList, PickListRank } from './types';

export type GetPickListsOptions = {
  organizationId?: number | null;
  eventKey?: string | null;
};

const toTimestampString = (value: number | null | undefined): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value * 1000).toISOString();
};

const toBoolean = (value: number | boolean | null | undefined): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  return value === 1;
};

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeRank = (row: typeof schema.pickListRanks.$inferSelect): PickListRank => ({
  rank: row.rank,
  teamNumber: row.teamNumber,
  notes: typeof row.notes === 'string' ? row.notes : '',
  dnp: toBoolean(row.dnp),
});

export async function getPickListsFromDatabase(
  options: GetPickListsOptions = {},
): Promise<PickList[]> {
  const db = getDbOrThrow();

  const conditions = [] as ReturnType<typeof eq>[];

  if (options.organizationId != null) {
    conditions.push(eq(schema.pickLists.organizationId, options.organizationId));
  }

  if (options.eventKey !== undefined) {
    const eventCondition =
      options.eventKey === null
        ? isNull(schema.pickLists.eventKey)
        : eq(schema.pickLists.eventKey, options.eventKey);

    conditions.push(eventCondition);
  }

  let query = db.select().from(schema.pickLists);

  if (conditions.length === 1) {
    query = query.where(conditions[0]);
  } else if (conditions.length > 1) {
    query = query.where(and(...conditions));
  }

  const pickListRows = query.all();

  const pickListIds = pickListRows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const rankRows =
    pickListIds.length > 0
      ? db
          .select()
          .from(schema.pickListRanks)
          .where(inArray(schema.pickListRanks.pickListId, pickListIds))
          .orderBy(asc(schema.pickListRanks.rank))
          .all()
      : [];

  const ranksByPickList = new Map<string, PickListRank[]>();

  rankRows.forEach((row) => {
    const pickListId = normalizeText(row.pickListId);

    if (!pickListId) {
      return;
    }

    const ranks = ranksByPickList.get(pickListId) ?? [];
    ranks.push(normalizeRank(row));
    ranksByPickList.set(pickListId, ranks);
  });

  return pickListRows.map((row): PickList => {
    const id = typeof row.id === 'string' ? row.id : String(row.id);
    const rawEventKey = normalizeText(row.eventKey);

    return {
      id,
      season: typeof row.season === 'number' ? row.season : null,
      organizationId:
        typeof row.organizationId === 'number' && Number.isFinite(row.organizationId)
          ? row.organizationId
          : null,
      eventKey: rawEventKey,
      title: typeof row.title === 'string' && row.title.trim().length > 0 ? row.title : 'Pick List',
      notes: typeof row.notes === 'string' ? row.notes : '',
      createdAt: toTimestampString(row.created),
      updatedAt: toTimestampString(row.lastUpdated),
      favorited: toBoolean(row.favorited),
      ranks: ranksByPickList.get(id) ?? [],
    };
  });
}
