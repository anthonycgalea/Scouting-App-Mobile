import { apiRequest } from './api/client';
import type { AlreadyScoutedResponse } from './already-scouted';
import type { AlreadyPitScoutedResponse } from './pit-scouting';
import { getActiveEvent } from './logged-in-event';
import { getDbOrThrow, schema } from '@/db';
import { and, eq, inArray } from 'drizzle-orm';

export type RetrieveEventInfoResult = {
  eventCode: string;
  matchSchedule: {
    received: number;
    created: number;
    updated: number;
    removed: number;
  };
  teamEvents: {
    received: number;
    created: number;
    removed: number;
  };
  alreadyScouted: {
    received: number;
    created: number;
  };
  alreadyPitScouted: {
    received: number;
    created: number;
  };
};

type MatchScheduleResponse = {
  event_key?: string | null;
  match_number?: number | string | null;
  match_level?: string | null;
  red1_id?: number | string | null;
  red2_id?: number | string | null;
  red3_id?: number | string | null;
  blue1_id?: number | string | null;
  blue2_id?: number | string | null;
  blue3_id?: number | string | null;
};

type TeamEventResponse = {
  event_key?: string | null;
  team_number?: number | string | null;
};

type NormalizedMatchSchedule = {
  eventKey: string;
  matchNumber: number;
  matchLevel: string;
  red1Id: number;
  red2Id: number;
  red3Id: number;
  blue1Id: number;
  blue2Id: number;
  blue3Id: number;
};

type NormalizedTeamEvent = {
  eventKey: string;
  teamNumber: number;
};

type NormalizedAlreadyScouted = typeof schema.alreadyScouteds.$inferInsert;
type NormalizedAlreadyPitScouted = typeof schema.alreadyPitScouteds.$inferInsert;

const normalizeNumber = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeMatchSchedule = (
  item: MatchScheduleResponse,
  eventCode: string,
): NormalizedMatchSchedule | null => {
  const matchNumber = normalizeNumber(item.match_number);
  const matchLevel = typeof item.match_level === 'string' ? item.match_level.trim() : '';

  const red1Id = normalizeNumber(item.red1_id);
  const red2Id = normalizeNumber(item.red2_id);
  const red3Id = normalizeNumber(item.red3_id);
  const blue1Id = normalizeNumber(item.blue1_id);
  const blue2Id = normalizeNumber(item.blue2_id);
  const blue3Id = normalizeNumber(item.blue3_id);

  if (
    !matchLevel ||
    matchNumber === null ||
    red1Id === null ||
    red2Id === null ||
    red3Id === null ||
    blue1Id === null ||
    blue2Id === null ||
    blue3Id === null
  ) {
    return null;
  }

  return {
    eventKey: eventCode,
    matchNumber,
    matchLevel,
    red1Id,
    red2Id,
    red3Id,
    blue1Id,
    blue2Id,
    blue3Id,
  };
};

const normalizeTeamEvent = (
  item: TeamEventResponse,
  eventCode: string,
): NormalizedTeamEvent | null => {
  const teamNumber = normalizeNumber(item.team_number);

  if (teamNumber === null) {
    return null;
  }

  return { eventKey: eventCode, teamNumber };
};

const normalizeAlreadyScoutedEntry = (
  item: AlreadyScoutedResponse,
): NormalizedAlreadyScouted | null => {
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
    teamNumber,
    matchNumber,
    matchLevel,
    organizationId,
  };
};

const normalizeAlreadyPitScoutedEntry = (
  item: AlreadyPitScoutedResponse,
): NormalizedAlreadyPitScouted | null => {
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

export async function retrieveEventInfo(): Promise<RetrieveEventInfoResult> {
  const eventCode = getActiveEvent();

  if (!eventCode) {
    throw new Error('No event is currently selected. Please select an event and try again.');
  }

  const [rawMatchSchedules, rawTeamEvents, rawAlreadyScouted, rawAlreadyPitScouted] = await Promise.all([
    apiRequest<MatchScheduleResponse[]>(`/public/matchSchedule/${eventCode}`, {
      method: 'GET',
    }),
    apiRequest<TeamEventResponse[]>(`/public/event/teams/${eventCode}`, {
      method: 'GET',
    }),
    apiRequest<AlreadyScoutedResponse[]>('/scout/scouted', {
      method: 'GET',
    }),
    apiRequest<AlreadyPitScoutedResponse[]>('/scout/pitscouted', {
      method: 'GET',
    }),
  ]);

  const requiredTeamNumbers = new Set<number>();

  const normalizedMatchMap = new Map<string, NormalizedMatchSchedule>();
  for (const item of rawMatchSchedules ?? []) {
    const normalized = normalizeMatchSchedule(item, eventCode);

    if (!normalized) {
      continue;
    }

    requiredTeamNumbers.add(normalized.red1Id);
    requiredTeamNumbers.add(normalized.red2Id);
    requiredTeamNumbers.add(normalized.red3Id);
    requiredTeamNumbers.add(normalized.blue1Id);
    requiredTeamNumbers.add(normalized.blue2Id);
    requiredTeamNumbers.add(normalized.blue3Id);

    const key = `${normalized.matchLevel}#${normalized.matchNumber}`;

    if (!normalizedMatchMap.has(key)) {
      normalizedMatchMap.set(key, normalized);
    }
  }

  const normalizedTeamSet = new Map<number, NormalizedTeamEvent>();
  for (const item of rawTeamEvents ?? []) {
    const normalized = normalizeTeamEvent(item, eventCode);

    if (!normalized) {
      continue;
    }

    if (!normalizedTeamSet.has(normalized.teamNumber)) {
      normalizedTeamSet.set(normalized.teamNumber, normalized);
    }

    requiredTeamNumbers.add(normalized.teamNumber);
  }

  const db = getDbOrThrow();
  const organizationRows = db.select({ id: schema.organizations.id }).from(schema.organizations).all();
  const organizationIdSet = new Set(
    organizationRows
      .map((row) => row.id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
  );

  const normalizedAlreadyScoutedMap = new Map<string, NormalizedAlreadyScouted>();
  for (const item of rawAlreadyScouted ?? []) {
    const normalized = normalizeAlreadyScoutedEntry(item);

    if (!normalized) {
      continue;
    }

    if (normalized.eventCode !== eventCode || !organizationIdSet.has(normalized.organizationId)) {
      continue;
    }

    const key = `${normalized.eventCode}#${normalized.matchLevel}#${normalized.matchNumber}#${normalized.teamNumber}#${normalized.organizationId}`;

    if (!normalizedAlreadyScoutedMap.has(key)) {
      normalizedAlreadyScoutedMap.set(key, normalized);
    }

    requiredTeamNumbers.add(normalized.teamNumber);
  }

  const normalizedAlreadyPitScoutedMap = new Map<string, NormalizedAlreadyPitScouted>();
  for (const item of rawAlreadyPitScouted ?? []) {
    const normalized = normalizeAlreadyPitScoutedEntry(item);

    if (!normalized) {
      continue;
    }

    if (normalized.eventCode !== eventCode || !organizationIdSet.has(normalized.organizationId)) {
      continue;
    }

    const key = `${normalized.eventCode}#${normalized.teamNumber}#${normalized.organizationId}`;

    if (!normalizedAlreadyPitScoutedMap.has(key)) {
      normalizedAlreadyPitScoutedMap.set(key, normalized);
    }

    requiredTeamNumbers.add(normalized.teamNumber);
  }

  const matchScheduleResult: RetrieveEventInfoResult['matchSchedule'] = {
    received: normalizedMatchMap.size,
    created: 0,
    updated: 0,
    removed: 0,
  };

  const teamEventsResult: RetrieveEventInfoResult['teamEvents'] = {
    received: normalizedTeamSet.size,
    created: 0,
    removed: 0,
  };

  const alreadyScoutedResult: RetrieveEventInfoResult['alreadyScouted'] = {
    received: normalizedAlreadyScoutedMap.size,
    created: 0,
  };

  const alreadyPitScoutedResult: RetrieveEventInfoResult['alreadyPitScouted'] = {
    received: normalizedAlreadyPitScoutedMap.size,
    created: 0,
  };

  const requiredTeamNumberList = [...requiredTeamNumbers];

  db.transaction((tx) => {
    if (requiredTeamNumberList.length > 0) {
      const existingTeamRows = tx
        .select({ teamNumber: schema.teamRecords.teamNumber })
        .from(schema.teamRecords)
        .where(inArray(schema.teamRecords.teamNumber, requiredTeamNumberList))
        .all();

      const existingTeamNumbers = new Set<number>(existingTeamRows.map((row) => row.teamNumber));

      const placeholderTeams: typeof schema.teamRecords.$inferInsert[] = [];

      for (const teamNumber of requiredTeamNumberList) {
        if (!existingTeamNumbers.has(teamNumber)) {
          placeholderTeams.push({
            teamNumber,
            teamName: `Team ${teamNumber}`,
            location: null,
          });
        }
      }

      if (placeholderTeams.length > 0) {
        tx.insert(schema.teamRecords).values(placeholderTeams).onConflictDoNothing().run();
      }
    }

    const existingEvent = tx
      .select({ eventKey: schema.frcEvents.eventKey })
      .from(schema.frcEvents)
      .where(eq(schema.frcEvents.eventKey, eventCode))
      .limit(1)
      .all();

    if (existingEvent.length === 0) {
      const parsedYear = Number.parseInt(eventCode.slice(0, 4), 10);
      const year = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

      tx
        .insert(schema.frcEvents)
        .values({
          eventKey: eventCode,
          eventName: eventCode,
          shortName: null,
          year,
          week: 0,
        })
        .onConflictDoNothing()
        .run();
    }

    const existingMatchSchedules = tx
      .select()
      .from(schema.matchSchedules)
      .where(eq(schema.matchSchedules.eventKey, eventCode))
      .all();

    const existingMatchMap = new Map<string, typeof existingMatchSchedules[number]>();
    for (const existing of existingMatchSchedules) {
      const key = `${existing.matchLevel}#${existing.matchNumber}`;
      existingMatchMap.set(key, existing);
    }

    for (const [key, normalized] of normalizedMatchMap.entries()) {
      const existing = existingMatchMap.get(key);

      if (!existing) {
        tx.insert(schema.matchSchedules).values(normalized).run();
        matchScheduleResult.created += 1;
        continue;
      }

      if (
        existing.red1Id !== normalized.red1Id ||
        existing.red2Id !== normalized.red2Id ||
        existing.red3Id !== normalized.red3Id ||
        existing.blue1Id !== normalized.blue1Id ||
        existing.blue2Id !== normalized.blue2Id ||
        existing.blue3Id !== normalized.blue3Id ||
        existing.matchLevel !== normalized.matchLevel ||
        existing.matchNumber !== normalized.matchNumber
      ) {
        tx
          .update(schema.matchSchedules)
          .set(normalized)
          .where(
            and(
              eq(schema.matchSchedules.eventKey, eventCode),
              eq(schema.matchSchedules.matchNumber, normalized.matchNumber),
              eq(schema.matchSchedules.matchLevel, normalized.matchLevel),
            ),
          )
          .run();
        matchScheduleResult.updated += 1;
      }

      existingMatchMap.delete(key);
    }

    for (const remaining of existingMatchMap.values()) {
      tx
        .delete(schema.matchSchedules)
        .where(
          and(
            eq(schema.matchSchedules.eventKey, eventCode),
            eq(schema.matchSchedules.matchNumber, remaining.matchNumber),
            eq(schema.matchSchedules.matchLevel, remaining.matchLevel),
          ),
        )
        .run();
      matchScheduleResult.removed += 1;
    }

    const existingTeamEvents = tx
      .select()
      .from(schema.teamEvents)
      .where(eq(schema.teamEvents.eventKey, eventCode))
      .all();

    const existingTeamSet = new Set<number>();
    for (const existing of existingTeamEvents) {
      existingTeamSet.add(existing.teamNumber);
    }

    for (const normalized of normalizedTeamSet.values()) {
      if (!existingTeamSet.has(normalized.teamNumber)) {
        tx.insert(schema.teamEvents).values(normalized).run();
        teamEventsResult.created += 1;
      }

      existingTeamSet.delete(normalized.teamNumber);
    }

    for (const teamNumber of existingTeamSet.values()) {
      tx
        .delete(schema.teamEvents)
        .where(
          and(eq(schema.teamEvents.eventKey, eventCode), eq(schema.teamEvents.teamNumber, teamNumber)),
        )
        .run();
      teamEventsResult.removed += 1;
    }

    for (const normalized of normalizedAlreadyScoutedMap.values()) {
      const result = tx
        .insert(schema.alreadyScouteds)
        .values(normalized)
        .onConflictDoNothing()
        .run();

      if (result.rowsAffected > 0) {
        alreadyScoutedResult.created += 1;
      }
    }

    for (const normalized of normalizedAlreadyPitScoutedMap.values()) {
      const result = tx
        .insert(schema.alreadyPitScouteds)
        .values(normalized)
        .onConflictDoNothing()
        .run();

      if (result.rowsAffected > 0) {
        alreadyPitScoutedResult.created += 1;
      }
    }
  });

  return {
    eventCode,
    matchSchedule: matchScheduleResult,
    teamEvents: teamEventsResult,
    alreadyScouted: alreadyScoutedResult,
    alreadyPitScouted: alreadyPitScoutedResult,
  };
}
