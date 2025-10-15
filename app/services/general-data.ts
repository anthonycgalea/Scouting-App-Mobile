import { apiRequest } from './api/client';
import { getUserEvent, getUserOrganization } from './api/user';
import { setActiveEvent } from './logged-in-event';
import { setActiveOrganization } from './logged-in-organization';
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

type OrganizationResponse = {
  id: number;
  name: string;
  team_number: number;
};

type UserOrganizationResponse = {
  id: number;
  organization_id?: number;
  team_number?: number;
  user_organization_id?: number;
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
  organizations: UpsertResult;
  userOrganizations: UpsertResult;
  loggedInEvent: LoggedInEventSyncResult;
  loggedInOrganization: LoggedInOrganizationSyncResult;
};

type LoggedInEventSyncResult = {
  eventCode: string | null;
};

type LoggedInOrganizationSyncResult = {
  organizationId: number | null;
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

const normalizeOrganization = (organization: OrganizationResponse) => ({
  id: organization.id,
  name: organization.name,
  teamNumber: organization.team_number,
});

type NormalizedUserOrganization = {
  id: number;
  organizationId: number;
  teamNumber: number;
};

const normalizeUserOrganization = (
  userOrganization: UserOrganizationResponse,
): NormalizedUserOrganization | null => {
  const id =
    typeof userOrganization.user_organization_id === 'number'
      ? userOrganization.user_organization_id
      : typeof userOrganization.id === 'number' &&
          typeof userOrganization.organization_id === 'number'
        ? userOrganization.id
        : null;

  const organizationId =
    typeof userOrganization.organization_id === 'number'
      ? userOrganization.organization_id
      : typeof userOrganization.id === 'number' &&
          typeof userOrganization.user_organization_id === 'number'
        ? userOrganization.id
        : null;

  const teamNumber =
    typeof userOrganization.team_number === 'number'
      ? userOrganization.team_number
      : null;

  if (id === null || organizationId === null || teamNumber === null) {
    return null;
  }

  return { id, organizationId, teamNumber };
};

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

async function syncOrganizations(): Promise<UpsertResult> {
  const db = getDbOrThrow();
  let created = 0;
  let updated = 0;

  const data = await apiRequest<PaginatedResponse<OrganizationResponse>>('/organizations', {
    method: 'GET',
  });

  const organizations = extractItems(data);

  if (organizations.length === 0) {
    db.transaction((tx) => {
      const existing = tx.select().from(schema.organizations).all();

      for (const organization of existing) {
        tx.delete(schema.userOrganizations).where(eq(schema.userOrganizations.organizationId, organization.id)).run();
        tx.delete(schema.organizations).where(eq(schema.organizations.id, organization.id)).run();
      }
    });

    return { created, updated };
  }

  db.transaction((tx) => {
    const receivedIds = new Set<number>();

    for (const organization of organizations) {
      if (typeof organization.id !== 'number') {
        continue;
      }

      receivedIds.add(organization.id);

      if (!organization.name || typeof organization.team_number !== 'number') {
        continue;
      }

      const normalized = normalizeOrganization(organization);
      const existing = tx
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, normalized.id))
        .limit(1)
        .all();

      const existingRecord = existing[0];

      if (!existingRecord) {
        tx.insert(schema.organizations).values(normalized).run();
        created += 1;
        continue;
      }

      if (
        existingRecord.name !== normalized.name ||
        existingRecord.teamNumber !== normalized.teamNumber
      ) {
        tx
          .update(schema.organizations)
          .set(normalized)
          .where(eq(schema.organizations.id, normalized.id))
          .run();
        updated += 1;
      }
    }

    const existingOrganizations = tx.select().from(schema.organizations).all();
    for (const existingOrganization of existingOrganizations) {
      if (!receivedIds.has(existingOrganization.id)) {
        tx
          .delete(schema.userOrganizations)
          .where(eq(schema.userOrganizations.organizationId, existingOrganization.id))
          .run();
        tx
          .delete(schema.organizations)
          .where(eq(schema.organizations.id, existingOrganization.id))
          .run();
      }
    }
  });

  return { created, updated };
}

async function syncUserOrganizations(): Promise<UpsertResult> {
  const db = getDbOrThrow();
  let created = 0;
  let updated = 0;

  const data = await apiRequest<PaginatedResponse<UserOrganizationResponse>>('/user/organizations', {
    method: 'GET',
  });

  const userOrganizations = extractItems(data);

  if (userOrganizations.length === 0) {
    db.transaction((tx) => {
      tx.delete(schema.userOrganizations).run();
    });

    return { created, updated };
  }

  db.transaction((tx) => {
    const receivedIds = new Set<number>();

    for (const userOrganization of userOrganizations) {
      const normalized = normalizeUserOrganization(userOrganization);

      if (!normalized) {
        continue;
      }

      receivedIds.add(normalized.id);

      const existing = tx
        .select()
        .from(schema.userOrganizations)
        .where(eq(schema.userOrganizations.id, normalized.id))
        .limit(1)
        .all();

      const existingRecord = existing[0];

      if (!existingRecord) {
        tx.insert(schema.userOrganizations).values(normalized).run();
        created += 1;
        continue;
      }

      if (
        existingRecord.organizationId !== normalized.organizationId ||
        existingRecord.teamNumber !== normalized.teamNumber
      ) {
        tx
          .update(schema.userOrganizations)
          .set(normalized)
          .where(eq(schema.userOrganizations.id, normalized.id))
          .run();
        updated += 1;
      }
    }

    const existingUserOrganizations = tx.select().from(schema.userOrganizations).all();
    for (const existingUserOrganization of existingUserOrganizations) {
      if (!receivedIds.has(existingUserOrganization.id)) {
        tx
          .delete(schema.userOrganizations)
          .where(eq(schema.userOrganizations.id, existingUserOrganization.id))
          .run();
      }
    }
  });

  return { created, updated };
}

async function syncLoggedInOrganization(): Promise<LoggedInOrganizationSyncResult> {
  const response = await getUserOrganization();

  const possibleValues = [response?.organizationId, response?.organization_id];
  let normalizedOrganizationId: number | null = null;

  for (const value of possibleValues) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalizedOrganizationId = value;
      break;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);

      if (Number.isFinite(parsed)) {
        normalizedOrganizationId = parsed;
        break;
      }
    }
  }

  setActiveOrganization(normalizedOrganizationId);

  return { organizationId: normalizedOrganizationId };
}

async function syncLoggedInEvent(): Promise<LoggedInEventSyncResult> {
  const response = await getUserEvent();
  const rawEventCode = typeof response.eventCode === 'string' ? response.eventCode.trim() : '';
  const normalizedEventCode = rawEventCode.length > 0 ? rawEventCode : null;

  setActiveEvent(normalizedEventCode);

  return { eventCode: normalizedEventCode };
}

export async function updateGeneralData(): Promise<UpdateGeneralDataResult> {
  const teams = await syncTeams();
  const events = await syncEvents(2025);
  const organizations = await syncOrganizations();
  const userOrganizations = await syncUserOrganizations();
  const loggedInOrganization = await syncLoggedInOrganization();
  const loggedInEvent = await syncLoggedInEvent();

  return { teams, events, organizations, userOrganizations, loggedInOrganization, loggedInEvent };
}
