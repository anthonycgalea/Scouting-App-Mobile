import { getUserEvent } from './api/user';
import { apiRequest } from './api/client';
import { retrieveEventInfo, type RetrieveEventInfoResult } from './event-info';
import { getActiveEvent, setActiveEvent } from './logged-in-event';
import { syncAlreadyScoutedEntries } from './already-scouted';
import { syncAlreadyPitScoutedEntries } from './pit-scouting';
import { syncPendingRobotPhotos } from './robot-photos';
import { getDbOrThrow, schema } from '@/db';
import { eq } from 'drizzle-orm';

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
};

const normalizeEventCode = (rawEventCode: unknown): string | null => {
  if (typeof rawEventCode !== 'string') {
    return null;
  }

  const trimmed = rawEventCode.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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
  };
}
