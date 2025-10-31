import { apiRequest, type ApiRequestParams } from './client';

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
};

const extractCollection = (response: unknown): unknown[] => {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === 'object') {
    const container = response as Record<string, unknown>;
    const possibleKeys = ['data', 'items', 'results'];

    for (const key of possibleKeys) {
      const value = container[key];
      if (Array.isArray(value)) {
        return value;
      }

      if (value && typeof value === 'object') {
        const nested = value as Record<string, unknown>;
        for (const nestedKey of possibleKeys) {
          const nestedValue = nested[nestedKey];
          if (Array.isArray(nestedValue)) {
            return nestedValue;
          }
        }
      }
    }
  }

  return [];
};

export interface OrganizationEvent {
  eventKey: string;
  name: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
}

const normalizeOrganizationEvent = (value: unknown): OrganizationEvent | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const eventKey =
    toString(record.eventKey) ||
    toString(record.event_key) ||
    toString(record.eventCode) ||
    toString(record.event_code) ||
    toString(record.key);

  if (!eventKey) {
    return null;
  }

  const name =
    toString(record.name) ||
    toString(record.event_name) ||
    toString(record.title) ||
    eventKey;

  const isActive =
    toBoolean(record.isActive) ||
    toBoolean(record.is_active) ||
    toBoolean(record.active);

  const startDate =
    toString(record.startDate) ||
    toString(record.start_date) ||
    toString(record.start);

  const endDate =
    toString(record.endDate) ||
    toString(record.end_date) ||
    toString(record.end);

  return {
    eventKey,
    name: name ?? null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    isActive,
  };
};

export interface FetchOrganizationEventsParams {
  organizationId?: number | null;
}

export const fetchOrganizationEvents = async (
  params?: FetchOrganizationEventsParams,
): Promise<OrganizationEvent[]> => {
  const requestParams: ApiRequestParams | undefined = params?.organizationId
    ? { organization_id: params.organizationId }
    : undefined;

  const response = await apiRequest<unknown>('/organization/events', {
    method: 'GET',
    params: requestParams,
  });

  const items = extractCollection(response);

  return items
    .map(normalizeOrganizationEvent)
    .filter((event): event is OrganizationEvent => event !== null)
    .sort((a, b) => a.eventKey.localeCompare(b.eventKey));
};

export interface EventTeam {
  teamNumber: number;
  teamName: string | null;
  nickname?: string | null;
  location?: string | null;
}

const normalizeEventTeam = (value: unknown): EventTeam | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const teamNumber =
    toNumber(record.teamNumber) ||
    toNumber(record.team_number) ||
    toNumber(record.team) ||
    toNumber(record.number);

  if (teamNumber === null) {
    return null;
  }

  const teamName =
    toString(record.teamName) ||
    toString(record.team_name) ||
    toString(record.nickname) ||
    toString(record.name);

  const location =
    toString(record.location) ||
    toString(record.city) ||
    toString(record.state_prov);

  return {
    teamNumber,
    teamName: teamName ?? null,
    nickname: toString(record.nickname) ?? null,
    location: location ?? null,
  };
};

export interface FetchEventTeamsParams {
  eventKey: string;
}

export const fetchEventTeams = async (
  params: FetchEventTeamsParams,
): Promise<EventTeam[]> => {
  if (!params.eventKey) {
    return [];
  }

  const requestParams: ApiRequestParams = { event_key: params.eventKey };

  const response = await apiRequest<unknown>('/event/teams', {
    method: 'GET',
    params: requestParams,
  });

  const items = extractCollection(response);

  return items
    .map(normalizeEventTeam)
    .filter((team): team is EventTeam => team !== null)
    .sort((a, b) => a.teamNumber - b.teamNumber);
};
