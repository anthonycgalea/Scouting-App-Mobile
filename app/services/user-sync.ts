import { getUserEvent, getUserOrganization } from './api/user';
import { getActiveEvent, setActiveEvent } from './logged-in-event';
import { getActiveOrganizationId, setActiveOrganization } from './logged-in-organization';

export type RefreshUserAssignmentsResult = {
  organizationChanged: boolean;
  eventChanged: boolean;
  organizationId: number | null;
  eventCode: string | null;
};

const normalizeOrganizationId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const extractOrganizationId = (
  response: Awaited<ReturnType<typeof getUserOrganization>>,
): number | null => {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const possibleValues = [
    (response as { organizationId?: unknown }).organizationId,
    (response as { organization_id?: unknown }).organization_id,
  ];

  for (const value of possibleValues) {
    const normalized = normalizeOrganizationId(value);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
};

const extractEventCode = (response: Awaited<ReturnType<typeof getUserEvent>>): string | null => {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const rawEventCode = (response as { eventCode?: unknown }).eventCode;

  if (typeof rawEventCode !== 'string') {
    return null;
  }

  const trimmed = rawEventCode.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function refreshUserAssignmentsFromServer(): Promise<RefreshUserAssignmentsResult> {
  const [organizationResponse, eventResponse] = await Promise.all([
    getUserOrganization(),
    getUserEvent(),
  ]);

  const remoteOrganizationId = extractOrganizationId(organizationResponse);
  const remoteEventCode = extractEventCode(eventResponse);

  const currentOrganizationId = getActiveOrganizationId();
  const currentEventCode = getActiveEvent();

  const organizationChanged = currentOrganizationId !== remoteOrganizationId;
  const eventChanged = currentEventCode !== remoteEventCode;

  if (organizationChanged) {
    setActiveOrganization(remoteOrganizationId);
  }

  if (eventChanged) {
    setActiveEvent(remoteEventCode);
  }

  return {
    organizationChanged,
    eventChanged,
    organizationId: remoteOrganizationId,
    eventCode: remoteEventCode,
  };
}
