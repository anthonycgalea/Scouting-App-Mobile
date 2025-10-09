import { apiRequest } from './api/client';
import { getDbOrThrow, schema } from '@/db';
import { eq } from 'drizzle-orm';

type TeamRecordResponse = {
  team_number: number;
  team_name: string;
  location?: string | null;
  rookieYear?: string | number | null;
};

type EventResponse = {
  event_key: string;
  event_name: string;
  short_name?: string | null;
  year: number;
  week: number | null;
};

type PaginatedResponseMeta = {
  page?: number | null;
  currentPage?: number | null;
  pageSize?: number | null;
  totalItems?: number | null;
  totalPages?: number | null;
  lastPage?: number | null;
  hasNext?: boolean | null;
  nextPage?: number | null;
};

type PaginatedResponseData<T> = {
  data?: T[] | { data?: T[]; items?: T[]; results?: T[] };
  items?: T[];
  results?: T[];
  meta?: PaginatedResponseMeta;
};

type PaginatedResponse<T> = T[] | PaginatedResponseData<T>;

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
  location: team.location ? team.location.trim() || null : null,
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

const resolveCurrentPage = <T>(response: PaginatedResponse<T>, requestedPage: number | undefined): number => {
  if (!Array.isArray(response)) {
    const meta = response?.meta;

    if (meta) {
      const { currentPage, page } = meta;

      if (typeof currentPage === 'number' && Number.isFinite(currentPage)) {
        return currentPage;
      }

      if (typeof page === 'number' && Number.isFinite(page)) {
        return page;
      }
    }
  }

  return requestedPage ?? 0;
};

function getNextPage<T>(
  response: PaginatedResponse<T>,
  requestedPage: number | undefined,
  receivedItems: T[],
): number | null {
  const currentPage = resolveCurrentPage(response, requestedPage);

  if (!Array.isArray(response)) {
    const meta = response?.meta;

    if (meta) {
      if (meta.hasNext === false) {
        return null;
      }

      if (meta.nextPage === null) {
        return null;
      }

      if (typeof meta.nextPage === 'number' && Number.isFinite(meta.nextPage)) {
        return meta.nextPage;
      }

      if (meta.hasNext === true) {
        return currentPage + 1;
      }
    }
  }

  if (receivedItems.length === 0) {
    return null;
  }

  return currentPage + 1;
}

async function syncTeams(): Promise<UpsertResult> {
  const db = getDbOrThrow();
  let page: number | undefined;
  let created = 0;
  let updated = 0;

  while (true) {
    const data = await apiRequest<PaginatedResponse<TeamRecordResponse>>('/public/teams', {
      method: 'GET',
      params: page !== undefined ? { page: page.toString() } : undefined,
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

    const nextPage = getNextPage(data, page, items);

    if (nextPage === null) {
      break;
    }

    if (page !== undefined && nextPage <= page) {
      page = page + 1;
      continue;
    }

    page = nextPage;
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
