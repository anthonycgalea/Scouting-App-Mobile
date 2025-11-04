import { getUserEvent } from './api/user';
import { apiRequest } from './api/client';
import { retrieveEventInfo, type RetrieveEventInfoResult } from './event-info';
import { syncPickLists, type SyncPickListsResult } from './pick-lists';
import { getActiveEvent, setActiveEvent } from './logged-in-event';
import { syncAlreadyScoutedEntries } from './already-scouted';
import { syncAlreadyPitScoutedEntries } from './pit-scouting';
import { syncPendingRobotPhotos } from './robot-photos';
import { getDbOrThrow, schema } from '@/db';
import { and, eq, inArray } from 'drizzle-orm';

export type SyncDataWithServerResult = {
  eventCode: string;
  eventChanged: boolean;
  eventInfo: RetrieveEventInfoResult;
  matchDataSent: number;
  pitDataSent: number;
  prescoutDataSent: number;
  superScoutDataSent: number;
  alreadyScoutedUpdated: number;
  alreadyPitScoutedUpdated: number;
  alreadySuperScoutedUpdated: number;
  robotPhotosUploaded: number;
  superScoutFieldsSynced: number;
  pickLists: SyncPickListsResult;
};

const normalizeEventCode = (rawEventCode: unknown): string | null => {
  if (typeof rawEventCode !== 'string') {
    return null;
  }

  const trimmed = rawEventCode.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type RemoteSuperScoutField = {
  key?: unknown;
  label?: unknown;
};

const normalizeSuperScoutField = (
  field: RemoteSuperScoutField,
): { key: string; label: string } | null => {
  if (typeof field?.key !== 'string') {
    return null;
  }

  const normalizedKey = field.key.trim();

  if (normalizedKey.length === 0) {
    return null;
  }

  const rawLabel = typeof field.label === 'string' ? field.label.trim() : '';
  const normalizedLabel = rawLabel.length > 0 ? rawLabel : normalizedKey;

  return { key: normalizedKey, label: normalizedLabel };
};

type RemotePrescoutResponse = {
  event_key?: unknown;
  team_number?: unknown;
  match_number?: unknown;
  match_level?: unknown;
  notes?: unknown;
  al4c?: unknown;
  al3c?: unknown;
  al2c?: unknown;
  al1c?: unknown;
  tl4c?: unknown;
  tl3c?: unknown;
  tl2c?: unknown;
  tl1c?: unknown;
  aProcessor?: unknown;
  tProcessor?: unknown;
  aNet?: unknown;
  tNet?: unknown;
  a_processor?: unknown;
  t_processor?: unknown;
  a_net?: unknown;
  t_net?: unknown;
  endgame?: unknown;
  organization_id?: unknown;
};

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeCountValue = (value: unknown): number => {
  const parsed = parseNumericValue(value);

  if (parsed === null) {
    return 0;
  }

  const rounded = Math.trunc(parsed);
  return rounded >= 0 ? rounded : 0;
};

const normalizeEndgameValue = (value: unknown): 'NONE' | 'PARK' | 'SHALLOW' | 'DEEP' => {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();

    if (normalized === 'PARK' || normalized === 'SHALLOW' || normalized === 'DEEP') {
      return normalized;
    }
  }

  return 'NONE';
};

type NormalizedPrescoutEntry = {
  organizationId: number | null;
  row: typeof schema.prescoutMatchData2025.$inferInsert;
};

const normalizePrescoutResponse = (
  item: RemotePrescoutResponse,
): NormalizedPrescoutEntry | null => {
  const eventKey = typeof item.event_key === 'string' ? item.event_key.trim() : '';
  const rawMatchLevel = typeof item.match_level === 'string' ? item.match_level.trim() : '';
  const matchLevel = rawMatchLevel.toUpperCase();
  const teamNumber = parseNumericValue(item.team_number);
  const matchNumber = parseNumericValue(item.match_number);
  const organizationId = parseNumericValue(item.organization_id);

  if (!eventKey || !matchLevel || teamNumber === null || matchNumber === null) {
    return null;
  }

  const notes = typeof item.notes === 'string' ? item.notes : null;

  const row: typeof schema.prescoutMatchData2025.$inferInsert = {
    eventKey,
    teamNumber: Math.trunc(teamNumber),
    matchNumber: Math.trunc(matchNumber),
    matchLevel,
    notes,
    al4c: normalizeCountValue(item.al4c),
    al3c: normalizeCountValue(item.al3c),
    al2c: normalizeCountValue(item.al2c),
    al1c: normalizeCountValue(item.al1c),
    tl4c: normalizeCountValue(item.tl4c),
    tl3c: normalizeCountValue(item.tl3c),
    tl2c: normalizeCountValue(item.tl2c),
    tl1c: normalizeCountValue(item.tl1c),
    aProcessor: normalizeCountValue(item.aProcessor ?? item.a_processor),
    tProcessor: normalizeCountValue(item.tProcessor ?? item.t_processor),
    aNet: normalizeCountValue(item.aNet ?? item.a_net),
    tNet: normalizeCountValue(item.tNet ?? item.t_net),
    endgame: normalizeEndgameValue(item.endgame),
    alreadyUploaded: 1,
  };

  return { organizationId: organizationId === null ? null : Math.trunc(organizationId), row };
};

async function syncSuperScoutFields(): Promise<number> {
  const response = await apiRequest<RemoteSuperScoutField[] | null | undefined>(
    '/scout/superscout/fields',
    { method: 'GET' }
  );

  const fields = Array.isArray(response)
    ? response
        .map((field) => normalizeSuperScoutField(field))
        .filter((field): field is { key: string; label: string } => field !== null)
    : [];

  const db = getDbOrThrow();

  db.transaction((tx) => {
    if (fields.length === 0) {
      tx.delete(schema.superScoutSelections).run();
      tx.delete(schema.superScoutFields).run();
      return;
    }

    const desiredKeys = new Set(fields.map((field) => field.key));

    const existingKeys = tx
      .select({ key: schema.superScoutFields.key })
      .from(schema.superScoutFields)
      .all()
      .map((row) => row.key)
      .filter((key): key is string => typeof key === 'string');

    const keysToRemove = existingKeys.filter((key) => !desiredKeys.has(key));

    if (keysToRemove.length > 0) {
      tx.delete(schema.superScoutSelections)
        .where(inArray(schema.superScoutSelections.fieldKey, keysToRemove))
        .run();
      tx.delete(schema.superScoutFields)
        .where(inArray(schema.superScoutFields.key, keysToRemove))
        .run();
    }

    for (const field of fields) {
      tx
        .insert(schema.superScoutFields)
        .values(field)
        .onConflictDoUpdate({
          target: schema.superScoutFields.key,
          set: { label: field.label },
        })
        .run();
    }
  });

  return fields.length;
}

async function syncPrescoutEntries(eventCode: string, organizationId: number): Promise<number> {
  const response = await apiRequest<RemotePrescoutResponse[] | null | undefined>(
    '/scout/prescout',
    { method: 'GET' },
  );

  const normalized = Array.isArray(response)
    ? response
        .map((item) => normalizePrescoutResponse(item))
        .filter((entry): entry is NormalizedPrescoutEntry => entry !== null)
        .filter(
          (entry) =>
            entry.row.eventKey === eventCode && entry.organizationId === organizationId,
        )
        .map((entry) => entry.row)
    : [];

  if (normalized.length === 0) {
    return 0;
  }

  const db = getDbOrThrow();

  return db.transaction((tx) => {
    let applied = 0;

    for (const entry of normalized) {
      const existing = tx
        .select({ alreadyUploaded: schema.prescoutMatchData2025.alreadyUploaded })
        .from(schema.prescoutMatchData2025)
        .where(
          and(
            eq(schema.prescoutMatchData2025.eventKey, entry.eventKey),
            eq(schema.prescoutMatchData2025.teamNumber, entry.teamNumber),
            eq(schema.prescoutMatchData2025.matchNumber, entry.matchNumber),
            eq(schema.prescoutMatchData2025.matchLevel, entry.matchLevel),
          ),
        )
        .all()[0];

      if (!existing) {
        tx.insert(schema.prescoutMatchData2025).values(entry).run();
        applied += 1;
        continue;
      }

      if (existing.alreadyUploaded === 1) {
        tx
          .update(schema.prescoutMatchData2025)
          .set(entry)
          .where(
            and(
              eq(schema.prescoutMatchData2025.eventKey, entry.eventKey),
              eq(schema.prescoutMatchData2025.teamNumber, entry.teamNumber),
              eq(schema.prescoutMatchData2025.matchNumber, entry.matchNumber),
              eq(schema.prescoutMatchData2025.matchLevel, entry.matchLevel),
            ),
          )
          .run();
        applied += 1;
      }
    }

    return applied;
  });
}

export async function syncDataWithServer(organizationId: number): Promise<SyncDataWithServerResult> {
  const userEventResponse = await getUserEvent();
  const remoteEventCode = normalizeEventCode(userEventResponse?.eventCode);
  const currentEventCode = getActiveEvent();

  if (remoteEventCode !== currentEventCode) {
    setActiveEvent(remoteEventCode);
  }

  if (!remoteEventCode) {
    throw new Error('No event is currently assigned to your account.');
  }

  const eventInfo = await retrieveEventInfo();
  const pickLists = await syncPickLists(organizationId);
  const db = getDbOrThrow();

  const superScoutFieldsSynced = await syncSuperScoutFields();
  await syncPrescoutEntries(remoteEventCode, organizationId);

  let superScoutDataSent = 0;

  const matchRows = db
    .select()
    .from(schema.matchData2025)
    .where(eq(schema.matchData2025.eventKey, remoteEventCode))
    .all();

  if (matchRows.length > 0) {
    await apiRequest('/scout/submit/batch', {
      method: 'POST',
      body: JSON.stringify(matchRows),
    });
  }

  const pitRows = db
    .select()
    .from(schema.pitData2025)
    .where(eq(schema.pitData2025.eventKey, remoteEventCode))
    .all();

  if (pitRows.length > 0) {
    await apiRequest('/scout/pit/batch', {
      method: 'POST',
      body: JSON.stringify(pitRows),
    });
  }

  const prescoutRows = db
    .select()
    .from(schema.prescoutMatchData2025)
    .where(
      and(
        eq(schema.prescoutMatchData2025.eventKey, remoteEventCode),
        eq(schema.prescoutMatchData2025.alreadyUploaded, 0),
      ),
    )
    .all();

  if (prescoutRows.length > 0) {
    const prescoutPayload = prescoutRows.map(({ alreadyUploaded, ...rest }) => rest);

    await apiRequest('/scout/prescout/batch', {
      method: 'POST',
      body: JSON.stringify(prescoutPayload),
    });

    db.transaction((tx) => {
      for (const row of prescoutRows) {
        tx
          .update(schema.prescoutMatchData2025)
          .set({ alreadyUploaded: 1 })
          .where(
            and(
              eq(schema.prescoutMatchData2025.eventKey, row.eventKey),
              eq(schema.prescoutMatchData2025.teamNumber, row.teamNumber),
              eq(schema.prescoutMatchData2025.matchNumber, row.matchNumber),
              eq(schema.prescoutMatchData2025.matchLevel, row.matchLevel),
            ),
          )
          .run();
      }
    });
  }

  const pendingSuperScoutRows = db
    .select()
    .from(schema.superScoutData)
    .where(
      and(
        eq(schema.superScoutData.eventKey, remoteEventCode),
        eq(schema.superScoutData.submissionPending, 1),
      ),
    )
    .all();

  if (pendingSuperScoutRows.length > 0) {
    const fieldRows = db.select().from(schema.superScoutFields).all();
    const fieldKeys = fieldRows
      .map((row) => row.key)
      .filter((key): key is string => typeof key === 'string' && key.trim().length > 0);

    const selectionRows = db
      .select()
      .from(schema.superScoutSelections)
      .where(eq(schema.superScoutSelections.eventKey, remoteEventCode))
      .all();

    const selectionMap = new Map<string, Set<string>>();

    selectionRows.forEach((row) => {
      const key = `${row.eventKey}|${row.matchLevel}|${row.matchNumber}|${row.teamNumber}`;
      let set = selectionMap.get(key);

      if (!set) {
        set = new Set<string>();
        selectionMap.set(key, set);
      }

      if (typeof row.fieldKey === 'string' && row.fieldKey.trim().length > 0) {
        set.add(row.fieldKey);
      }
    });

    const successfullySubmitted: typeof pendingSuperScoutRows = [];

    for (const row of pendingSuperScoutRows) {
      const selectionKey = `${row.eventKey}|${row.matchLevel}|${row.matchNumber}|${row.teamNumber}`;
      const selectedFields = selectionMap.get(selectionKey) ?? new Set<string>();

      const payload: Record<string, unknown> = {
        team_number: row.teamNumber,
        match_number: row.matchNumber,
        match_level: row.matchLevel,
        notes: row.notes ?? '',
        driver_rating: row.driverRating,
        robot_overall: row.robotOverall,
      };

      const startPositionValue =
        row.startPosition && row.startPosition !== 'NO_SHOW' ? row.startPosition : undefined;

      if (startPositionValue) {
        payload.startPosition = startPositionValue;
      }

      if (row.defenseRating && row.defenseRating > 0) {
        payload.defense_rating = row.defenseRating;
      }

      fieldKeys.forEach((fieldKey) => {
        payload[fieldKey] = selectedFields.has(fieldKey);
      });

      try {
        await apiRequest('/scout/superscout', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        successfullySubmitted.push(row);
      } catch (error) {
        console.error('Failed to submit pending super scout data', error);
      }
    }

    if (successfullySubmitted.length > 0) {
      db.transaction((tx) => {
        for (const row of successfullySubmitted) {
          tx
            .update(schema.superScoutData)
            .set({ submissionPending: 0 })
            .where(
              and(
                eq(schema.superScoutData.eventKey, row.eventKey),
                eq(schema.superScoutData.teamNumber, row.teamNumber),
                eq(schema.superScoutData.matchNumber, row.matchNumber),
                eq(schema.superScoutData.matchLevel, row.matchLevel),
              ),
            )
            .run();
        }
      });

      superScoutDataSent = successfullySubmitted.length;
    }
  }

  const alreadyScoutedUpdated = await syncAlreadyScoutedEntries(organizationId);
  const alreadyPitScoutedUpdated = await syncAlreadyPitScoutedEntries(organizationId);
  const alreadySuperScoutedUpdated = eventInfo.alreadySuperScouted.created;
  const robotPhotosUploaded = await syncPendingRobotPhotos();

  return {
    eventCode: remoteEventCode,
    eventChanged: remoteEventCode !== currentEventCode,
    eventInfo,
    matchDataSent: matchRows.length,
    pitDataSent: pitRows.length,
    prescoutDataSent: prescoutRows.length,
    superScoutDataSent,
    alreadyScoutedUpdated,
    alreadyPitScoutedUpdated,
    alreadySuperScoutedUpdated,
    robotPhotosUploaded,
    superScoutFieldsSynced,
    pickLists,
  };
}
