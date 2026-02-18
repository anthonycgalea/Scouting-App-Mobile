import { getUserEvent } from './api/user';
import { apiRequest } from './api/client';
import { retrieveEventInfo, type RetrieveEventInfoResult } from './event-info';
import { syncPickLists, type SyncPickListsResult } from './pick-lists';
import { getActiveEvent, setActiveEvent } from './logged-in-event';
import { syncAlreadyScoutedEntries } from './already-scouted';
import { syncAlreadyPrescoutedEntries } from './prescouted';
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
  alreadyPrescoutedUpdated: number;
  alreadyPitScoutedUpdated: number;
  alreadySuperScoutedUpdated: number;
  alreadyRobotPhotosUpdated: number;
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

  let superScoutDataSent = 0;

  const matchRows = db
    .select()
    .from(schema.matchData2026)
    .where(eq(schema.matchData2026.eventKey, remoteEventCode))
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
    .from(schema.prescout2026)
    .where(eq(schema.prescout2026.eventKey, remoteEventCode))
    .all();

  if (prescoutRows.length > 0) {
    await apiRequest('/scout/prescout/batch', {
      method: 'POST',
      body: JSON.stringify(prescoutRows),
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
  const alreadyPrescoutedUpdated = await syncAlreadyPrescoutedEntries(remoteEventCode);
  const alreadyPitScoutedUpdated = await syncAlreadyPitScoutedEntries(organizationId);
  const alreadySuperScoutedUpdated = eventInfo.alreadySuperScouted.created;
  const alreadyRobotPhotosUpdated = eventInfo.alreadyRobotPhotos.created;
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
    alreadyPrescoutedUpdated,
    alreadyPitScoutedUpdated,
    alreadySuperScoutedUpdated,
    alreadyRobotPhotosUpdated,
    robotPhotosUploaded,
    superScoutFieldsSynced,
    pickLists,
  };
}
