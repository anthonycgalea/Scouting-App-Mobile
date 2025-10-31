import { fetchPickLists } from '@/app/services/api/pick-lists';
import { getDbOrThrow, schema } from '@/db';
import { eq, inArray } from 'drizzle-orm';

export type SyncPickListsResult = {
  received: number;
  created: number;
  updated: number;
  removed: number;
  ranksInserted: number;
};

const toUnixSeconds = (value: string | null | undefined): number | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
};

const normalizeEventKey = (value: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function syncPickLists(organizationId: number): Promise<SyncPickListsResult> {
  const remotePickLists = await fetchPickLists({ organizationId });
  const db = getDbOrThrow();

  let created = 0;
  let updated = 0;
  let removed = 0;
  let ranksInserted = 0;

  db.transaction((tx) => {
    const existingRows = tx
      .select({ id: schema.pickLists.id })
      .from(schema.pickLists)
      .where(eq(schema.pickLists.organizationId, organizationId))
      .all();

    const existingIds = new Set(
      existingRows
        .map((row) => (typeof row.id === 'string' ? row.id : null))
        .filter((id): id is string => id !== null),
    );

    const remoteIds = new Set(remotePickLists.map((list) => list.id));
    const idsToRemove = [...existingIds].filter((id) => !remoteIds.has(id));

    if (idsToRemove.length > 0) {
      tx
        .delete(schema.pickListRanks)
        .where(inArray(schema.pickListRanks.pickListId, idsToRemove))
        .run();
      tx.delete(schema.pickLists).where(inArray(schema.pickLists.id, idsToRemove)).run();
      removed = idsToRemove.length;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    for (const list of remotePickLists) {
      const createdSeconds = toUnixSeconds(list.createdAt) ?? nowSeconds;
      const updatedSeconds = toUnixSeconds(list.updatedAt) ?? createdSeconds;
      const season =
        typeof list.season === 'number' && Number.isFinite(list.season) ? list.season : null;
      const organizationValue =
        typeof list.organizationId === 'number' && Number.isFinite(list.organizationId)
          ? list.organizationId
          : organizationId;
      const eventKey = normalizeEventKey(list.eventKey);

      tx
        .insert(schema.pickLists)
        .values({
          id: list.id,
          season,
          organizationId: organizationValue,
          eventKey,
          title: list.title,
          notes: list.notes,
          created: createdSeconds,
          lastUpdated: updatedSeconds,
          favorited: list.favorited ? 1 : 0,
        })
        .onConflictDoUpdate({
          target: schema.pickLists.id,
          set: {
            season,
            organizationId: organizationValue,
            eventKey,
            title: list.title,
            notes: list.notes,
            lastUpdated: updatedSeconds,
            favorited: list.favorited ? 1 : 0,
          },
        })
        .run();

      if (existingIds.has(list.id)) {
        updated += 1;
      } else {
        created += 1;
      }

      tx.delete(schema.pickListRanks).where(eq(schema.pickListRanks.pickListId, list.id)).run();

      if (list.ranks.length > 0) {
        const rankValues = [...list.ranks]
          .sort((first, second) => first.rank - second.rank)
          .map((rank) => ({
            pickListId: list.id,
            rank: rank.rank,
            teamNumber: rank.teamNumber,
            notes: rank.notes,
            dnp: rank.dnp ? 1 : 0,
          }));

        tx.insert(schema.pickListRanks).values(rankValues).run();
        ranksInserted += rankValues.length;
      }
    }
  });

  return {
    received: remotePickLists.length,
    created,
    updated,
    removed,
    ranksInserted,
  };
}
