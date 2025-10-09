import { apiRequest } from './api/client';
import { getDbOrThrow, schema } from '@/db';
import { eq } from 'drizzle-orm';

type TeamRecordResponse = {
  team_number: number;
  team_name: string;
  location?: string | null;
};

type EventResponse = {
  event_key: string;
  event_name: string;
  short_name?: string | null;
  year: number;
  week: number | null;
};

type PaginatedResponse<T> =
  | T[]
  | {
      data?: T[] | { data?: T[]; items?: T[]; results?: T[] };
      items?: T[];
      results?: T[];
      meta?: {
        nextPage?: number | null;
        hasNext?: boolean;
        page?: number;
        currentPage?: number;
        totalPages?: number;
        lastPage?: number;
      };
    };

type UpsertResult = {
  created: number;
  updated: number;
};

export type UpdateGeneralDataResult = {
  teams: UpsertResult;
  events: UpsertResult;
};

const normalizeTeam = (team: TeamRecordResponse) => ({
  teamNumber: team.team_number,
  teamName: team.team_name,
  location: team.location ?? null,
});

const normalizeEvent = (event: EventResponse) => ({
  eventKey: event.event_key,
  eventName: event.event_name,
  shortName: event.short_name ?? null,
  year: typeof event.year === 'number' ? event.year : 0,
  week: typeof event.week === 'number' && Number.isFinite(event.week) ? event.week : 0,
});

function extractItems<T>(response: PaginatedResponse<T>): T[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (response?.data) {
    if (Array.isArray(response.data)) {
      return response.data;
    }

    if (Array.isArray(response.data.data)) {
      return response.data.data;
    }

    if (Array.isArray(response.data.items)) {
      return response.data.items;
    }

    if (Array.isArray(response.data.results)) {
      return response.data.results;
    }
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
}

function hasMorePages<T>(response: PaginatedResponse<T>, currentPage: number, receivedItems: T[]): boolean {
  if (!Array.isArray(response)) {
    const meta = response?.meta;

    if (meta) {
      if (typeof meta.nextPage === 'number') {
        return meta.nextPage > currentPage;
      }

      if (typeof meta.hasNext === 'boolean') {
        return meta.hasNext;
      }

      const totalPages = meta.totalPages ?? meta.lastPage;
      const page = meta.page ?? meta.currentPage;

      if (typeof page === 'number' && typeof totalPages === 'number') {
        return page < totalPages;
      }
    }
  }

  return receivedItems.length > 0;
}

async function syncTeams(): Promise<UpsertResult> {
  const db = getDbOrThrow();
  let page = 1;
  let created = 0;
  let updated = 0;

  while (true) {
    const data = await apiRequest<PaginatedResponse<TeamRecordResponse>>('/public/teams', {
      method: 'GET',
      params: { page: page.toString() },
    });

    const items = extractItems(data);

    if (items.length === 0) {
      break;
    }

    db.transaction((tx) => {
      for (const team of items) {
        if (typeof team.team_number !== 'number' || !team.team_name) {
          continue;
        }

        const normalized = normalizeTeam(team);
        const existing = tx
          .select()
          .from(schema.teamRecords)
          .where(eq(schema.teamRecords.teamNumber, normalized.teamNumber))
          .limit(1)
          .all();

        const existingRecord = existing[0];

        if (!existingRecord) {
          tx.insert(schema.teamRecords).values(normalized).run();
          created += 1;
          continue;
        }

        if (
          existingRecord.teamName !== normalized.teamName ||
          (existingRecord.location ?? null) !== normalized.location
        ) {
          tx.update(schema.teamRecords).set(normalized).where(eq(schema.teamRecords.teamNumber, normalized.teamNumber)).run();
          updated += 1;
        }
      }
    });

    if (!hasMorePages(data, page, items)) {
      break;
    }

    page += 1;
  }

  return { created, updated };
}

async function syncEvents(year: number): Promise<UpsertResult> {
  const db = getDbOrThrow();
  let created = 0;
  let updated = 0;

  const data = await apiRequest<PaginatedResponse<EventResponse>>(`/public/events/${year}`, {
    method: 'GET',
  });

  const events = extractItems(data);

  if (events.length === 0) {
    return { created, updated };
  }

  db.transaction((tx) => {
    for (const event of events) {
      if (!event.event_key || !event.event_name) {
        continue;
      }

      const normalized = normalizeEvent(event);
      const existing = tx
        .select()
        .from(schema.frcEvents)
        .where(eq(schema.frcEvents.eventKey, normalized.eventKey))
        .limit(1)
        .all();

      const existingRecord = existing[0];

      if (!existingRecord) {
        tx.insert(schema.frcEvents).values(normalized).run();
        created += 1;
        continue;
      }

      if (
        existingRecord.eventName !== normalized.eventName ||
        (existingRecord.shortName ?? null) !== normalized.shortName ||
        existingRecord.year !== normalized.year ||
        existingRecord.week !== normalized.week
      ) {
        tx.update(schema.frcEvents).set(normalized).where(eq(schema.frcEvents.eventKey, normalized.eventKey)).run();
        updated += 1;
      }
    }
  });

  return { created, updated };
}

export async function updateGeneralData(): Promise<UpdateGeneralDataResult> {
  const teams = await syncTeams();
  const events = await syncEvents(2025);

  return { teams, events };
}
