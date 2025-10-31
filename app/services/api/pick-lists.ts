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

export interface PickListRank {
  rank: number;
  teamNumber: number;
  notes: string;
  dnp: boolean;
}

const normalizePickListRank = (value: unknown): PickListRank | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rank =
    toNumber(record.rank) ||
    toNumber(record.rank_value) ||
    toNumber(record.position);

  const teamNumber =
    toNumber(record.teamNumber) ||
    toNumber(record.team_number) ||
    toNumber(record.team);

  if (rank === null || teamNumber === null) {
    return null;
  }

  const notes = toString(record.notes) || '';
  const dnp =
    toBoolean(record.dnp) ||
    toBoolean(record.is_dnp) ||
    toBoolean(record.do_not_pick);

  return {
    rank,
    teamNumber,
    notes,
    dnp,
  };
};

export interface PickList {
  id: string;
  season: number | null;
  organizationId: number | null;
  eventKey: string | null;
  title: string;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
  favorited: boolean;
  ranks: PickListRank[];
}

const normalizePickList = (value: unknown): PickList | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = toString(record.id) || toString(record.uuid);

  if (!id) {
    return null;
  }

  const season =
    toNumber(record.season) ||
    toNumber(record.season_id) ||
    toNumber(record.year);

  const organizationId =
    toNumber(record.organizationId) ||
    toNumber(record.organization_id) ||
    toNumber(record.org_id);

  const eventKey =
    toString(record.eventKey) ||
    toString(record.event_key) ||
    toString(record.eventCode);

  const title = toString(record.title) || 'Pick List';
  const notes = toString(record.notes) || '';

  const createdAt =
    toString(record.createdAt) ||
    toString(record.created_at) ||
    toString(record.created) ||
    null;

  const updatedAt =
    toString(record.updatedAt) ||
    toString(record.updated_at) ||
    toString(record.last_updated) ||
    null;

  const favorited =
    toBoolean(record.favorited) ||
    toBoolean(record.is_favorited) ||
    toBoolean(record.favorite);

  const ranksRaw = record.ranks;
  const ranks = Array.isArray(ranksRaw)
    ? ranksRaw
        .map(normalizePickListRank)
        .filter((rank): rank is PickListRank => rank !== null)
    : [];

  return {
    id,
    season,
    organizationId,
    eventKey: eventKey ?? null,
    title,
    notes,
    createdAt,
    updatedAt,
    favorited,
    ranks,
  };
};

export interface FetchPickListsParams {
  organizationId?: number | null;
  eventKey?: string | null;
}

export const fetchPickLists = async (
  params?: FetchPickListsParams,
): Promise<PickList[]> => {
  const requestParams: ApiRequestParams = {};

  if (params?.organizationId != null) {
    requestParams.organization_id = params.organizationId;
  }

  if (params?.eventKey) {
    requestParams.event_key = params.eventKey;
  }

  const response = await apiRequest<unknown>('/picklists', {
    method: 'GET',
    params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
  });

  const items = extractCollection(response);

  return items
    .map(normalizePickList)
    .filter((list): list is PickList => list !== null)
    .sort((a, b) => a.title.localeCompare(b.title));
};
