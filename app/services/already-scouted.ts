import { apiRequest } from './api';
import { getDbOrThrow, schema } from '@/db';

export type AlreadyScoutedResponse = {
  event_code?: string | null;
  team_number?: number | string | null;
  match_number?: number | string | null;
  match_level?: string | null;
  organization_id?: number | string | null;
};

const normalizeNumber = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeAlreadyScouted = (
  item: AlreadyScoutedResponse,
): typeof schema.alreadyScouteds.$inferInsert | null => {
  const eventCode = typeof item.event_code === 'string' ? item.event_code.trim() : '';
  const matchLevel = typeof item.match_level === 'string' ? item.match_level.trim() : '';
  const teamNumber = normalizeNumber(item.team_number);
  const matchNumber = normalizeNumber(item.match_number);
  const organizationId = normalizeNumber(item.organization_id);

  if (!eventCode || !matchLevel || teamNumber === null || matchNumber === null || organizationId === null) {
    return null;
  }

  return {
    eventCode,
    matchLevel,
    teamNumber,
    matchNumber,
    organizationId,
  };
};

export async function syncAlreadyScoutedEntries(organizationId: number): Promise<number> {
  const response = await apiRequest<AlreadyScoutedResponse[]>('/scout/scouted', {
    method: 'GET',
  });

  const entries = Array.isArray(response)
    ? response
        .map((item) => normalizeAlreadyScouted(item))
        .filter((entry): entry is typeof schema.alreadyScouteds.$inferInsert => !!entry)
        .filter((entry) => entry.organizationId === organizationId)
    : [];

  if (entries.length === 0) {
    return 0;
  }

  const db = getDbOrThrow();

  return db.transaction((tx) => {
    let inserted = 0;

    for (const entry of entries) {
      const result = tx
        .insert(schema.alreadyScouteds)
        .values(entry)
        .onConflictDoNothing()
        .run();

      if (result.rowsAffected > 0) {
        inserted += 1;
      }
    }

    return inserted;
  });
}
