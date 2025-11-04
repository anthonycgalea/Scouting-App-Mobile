import { apiRequest } from './api';
import { getDbOrThrow, schema } from '@/db';

export type AlreadyPrescoutedResponse = {
  event_key?: string | null;
  team_number?: number | string | null;
  match_number?: number | string | null;
  match_level?: string | null;
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

const normalizeAlreadyPrescouted = (
  item: AlreadyPrescoutedResponse,
): typeof schema.alreadyPrescouteds.$inferInsert | null => {
  const eventKey = typeof item.event_key === 'string' ? item.event_key.trim() : '';
  const matchLevel = typeof item.match_level === 'string' ? item.match_level.trim() : '';
  const teamNumber = normalizeNumber(item.team_number);
  const matchNumber = normalizeNumber(item.match_number);

  if (!eventKey || !matchLevel || teamNumber === null || matchNumber === null) {
    return null;
  }

  return {
    eventKey,
    matchLevel,
    teamNumber,
    matchNumber,
  };
};

export async function syncAlreadyPrescoutedEntries(eventKey: string): Promise<number> {
  const response = await apiRequest<AlreadyPrescoutedResponse[]>('/scout/prescout', {
    method: 'GET',
  });

  const desiredEventKey = eventKey.trim();

  const entries = Array.isArray(response)
    ? response
        .map((item) => normalizeAlreadyPrescouted(item))
        .filter((entry): entry is typeof schema.alreadyPrescouteds.$inferInsert => !!entry)
        .filter((entry) => !desiredEventKey || entry.eventKey === desiredEventKey)
    : [];

  if (entries.length === 0) {
    return 0;
  }

  const db = getDbOrThrow();

  return db.transaction((tx) => {
    let inserted = 0;

    for (const entry of entries) {
      const result = tx
        .insert(schema.alreadyPrescouteds)
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
