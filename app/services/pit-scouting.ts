import { apiRequest } from './api';
import { getDbOrThrow, schema } from '@/db';

type AlreadyPitScoutedResponse = {
  event_code?: string | null;
  team_number?: number | string | null;
  organization_id?: number | string | null;
};

type PitScoutSubmission = typeof schema.pitData2025.$inferSelect;

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

const normalizeAlreadyPitScouted = (
  item: AlreadyPitScoutedResponse,
): typeof schema.alreadyPitScouteds.$inferInsert | null => {
  const eventCode = typeof item.event_code === 'string' ? item.event_code.trim() : '';
  const teamNumber = normalizeNumber(item.team_number);
  const organizationId = normalizeNumber(item.organization_id);

  if (!eventCode || teamNumber === null || organizationId === null) {
    return null;
  }

  return {
    eventCode,
    teamNumber,
    organizationId,
  };
};

export async function submitPitScoutData(
  data: PitScoutSubmission,
  timeoutMs = 5000,
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    await apiRequest('/scout/pit', {
      method: 'POST',
      body: JSON.stringify(data),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function syncAlreadyPitScoutedEntries(organizationId: number): Promise<number> {
  const response = await apiRequest<AlreadyPitScoutedResponse[]>('/scout/pitscouted', {
    method: 'GET',
  });

  const entries = Array.isArray(response)
    ? response
        .map((item) => normalizeAlreadyPitScouted(item))
        .filter((entry): entry is typeof schema.alreadyPitScouteds.$inferInsert => !!entry)
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
        .insert(schema.alreadyPitScouteds)
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
