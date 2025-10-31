import { apiRequest } from './api';
import { getActiveEvent } from './logged-in-event';
import { getDbOrThrow, schema } from '@/db';

export type AlreadySuperScoutedResponse = {
  eventCode?: string | null;
  event_code?: string | null;
  matchLevel?: string | null;
  match_level?: string | null;
  matchNumber?: number | string | null;
  match_number?: number | string | null;
  red?: boolean | string | number | null;
  blue?: boolean | string | number | null;
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

const toBoolean = (value: boolean | string | number | null | undefined): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return false;
    }

    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
};

export const normalizeAlreadySuperScouted = (
  item: AlreadySuperScoutedResponse,
): typeof schema.alreadySuperScouteds.$inferInsert[] => {
  const eventCodeRaw =
    typeof item.eventCode === 'string'
      ? item.eventCode
      : typeof item.event_code === 'string'
      ? item.event_code
      : '';
  const matchLevelRaw =
    typeof item.matchLevel === 'string'
      ? item.matchLevel
      : typeof item.match_level === 'string'
      ? item.match_level
      : '';

  const eventCode = eventCodeRaw.trim();
  const matchLevel = matchLevelRaw.trim();
  const matchNumber = normalizeNumber(item.matchNumber ?? item.match_number ?? null);

  if (!eventCode || !matchLevel || matchNumber === null) {
    return [];
  }

  const entries: typeof schema.alreadySuperScouteds.$inferInsert[] = [];

  if (toBoolean(item.red ?? null)) {
    entries.push({ eventCode, matchLevel, matchNumber, alliance: 'red' });
  }

  if (toBoolean(item.blue ?? null)) {
    entries.push({ eventCode, matchLevel, matchNumber, alliance: 'blue' });
  }

  return entries;
};

export async function syncAlreadySuperScoutedEntries(
  eventCode?: string | null,
): Promise<number> {
  const resolvedEventCode = eventCode ?? getActiveEvent();

  if (!resolvedEventCode) {
    return 0;
  }

  const response = await apiRequest<AlreadySuperScoutedResponse[]>('/scout/superscouted', {
    method: 'GET',
  });

  const entries = Array.isArray(response)
    ? response
        .flatMap((item) => normalizeAlreadySuperScouted(item))
        .filter((entry) => entry.eventCode === resolvedEventCode)
    : [];

  if (entries.length === 0) {
    return 0;
  }

  const uniqueEntries = new Map<string, typeof schema.alreadySuperScouteds.$inferInsert>();

  for (const entry of entries) {
    const key = `${entry.eventCode}#${entry.matchLevel}#${entry.matchNumber}#${entry.alliance}`;

    if (!uniqueEntries.has(key)) {
      uniqueEntries.set(key, entry);
    }
  }

  const db = getDbOrThrow();

  return db.transaction((tx) => {
    let inserted = 0;

    for (const entry of uniqueEntries.values()) {
      const result = tx
        .insert(schema.alreadySuperScouteds)
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
