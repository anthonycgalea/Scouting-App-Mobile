import { getUserEvent } from './api/user';
import { apiRequest } from './api/client';
import { retrieveEventInfo, type RetrieveEventInfoResult } from './event-info';
import { getActiveEvent, setActiveEvent } from './logged-in-event';
import { syncAlreadyScoutedEntries } from './already-scouted';
import { syncAlreadyPitScoutedEntries } from './pit-scouting';
import { syncPendingRobotPhotos } from './robot-photos';
import { getDbOrThrow, schema } from '@/db';
import { eq, inArray } from 'drizzle-orm';

export type SyncDataWithServerResult = {
  eventCode: string;
  eventChanged: boolean;
  eventInfo: RetrieveEventInfoResult;
  matchDataSent: number;
  pitDataSent: number;
  prescoutDataSent: number;
  alreadyScoutedUpdated: number;
  alreadyPitScoutedUpdated: number;
  robotPhotosUploaded: number;
  superScoutFieldsSynced: number;
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
  const db = getDbOrThrow();

  const superScoutFieldsSynced = await syncSuperScoutFields();

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
    .where(eq(schema.prescoutMatchData2025.eventKey, remoteEventCode))
    .all();

  if (prescoutRows.length > 0) {
    await apiRequest('/scout/prescout/batch', {
      method: 'POST',
      body: JSON.stringify(prescoutRows),
    });
  }

  const alreadyScoutedUpdated = await syncAlreadyScoutedEntries(organizationId);
  const alreadyPitScoutedUpdated = await syncAlreadyPitScoutedEntries(organizationId);
  const robotPhotosUploaded = await syncPendingRobotPhotos();

  return {
    eventCode: remoteEventCode,
    eventChanged: remoteEventCode !== currentEventCode,
    eventInfo,
    matchDataSent: matchRows.length,
    pitDataSent: pitRows.length,
    prescoutDataSent: prescoutRows.length,
    alreadyScoutedUpdated,
    alreadyPitScoutedUpdated,
    robotPhotosUploaded,
    superScoutFieldsSynced,
  };
}
