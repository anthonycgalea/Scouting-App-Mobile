import { apiRequest } from './client';

export interface OrganizationResponse {
  id?: number | null;
  name?: string | null;
  team_number?: number | null;
}

type OrganizationsApiResponse =
  | OrganizationResponse[]
  | {
      data?: OrganizationResponse[] | {
        data?: OrganizationResponse[];
        items?: OrganizationResponse[];
        results?: OrganizationResponse[];
      };
      items?: OrganizationResponse[];
      results?: OrganizationResponse[];
    };

export type OrganizationListItem = {
  id: number;
  name: string;
  teamNumber: number;
};

const extractOrganizationItems = (
  response: OrganizationsApiResponse,
): OrganizationResponse[] => {
  if (Array.isArray(response)) {
    return response;
  }

  const possibleCollections = [
    response?.data,
    response?.items,
    response?.results,
    response?.data && typeof response.data === 'object'
      ? 'data' in response.data
        ? (response.data as { data?: OrganizationResponse[] }).data
        : undefined
      : undefined,
    response?.data && typeof response.data === 'object'
      ? 'items' in response.data
        ? (response.data as { items?: OrganizationResponse[] }).items
        : undefined
      : undefined,
    response?.data && typeof response.data === 'object'
      ? 'results' in response.data
        ? (response.data as { results?: OrganizationResponse[] }).results
        : undefined
      : undefined,
  ];

  for (const collection of possibleCollections) {
    if (Array.isArray(collection)) {
      return collection;
    }
  }

  return [];
};

export const fetchOrganizations = async (): Promise<OrganizationListItem[]> => {
  const response = await apiRequest<OrganizationsApiResponse>('/organizations', {
    method: 'GET',
  });

  const organizations = extractOrganizationItems(response);

  return organizations
    .filter((organization) => {
      return (
        typeof organization?.id === 'number' &&
        Number.isFinite(organization.id) &&
        typeof organization?.team_number === 'number' &&
        Number.isFinite(organization.team_number) &&
        typeof organization?.name === 'string' &&
        organization.name.trim().length > 0
      );
    })
    .map((organization) => ({
      id: organization.id as number,
      name: (organization.name ?? '').trim(),
      teamNumber: organization.team_number as number,
    }))
    .sort((a, b) => a.teamNumber - b.teamNumber);
};

export const applyToOrganization = async (organizationId: number) => {
  await apiRequest('/user/organization/apply', {
    method: 'POST',
    body: JSON.stringify({ organization_id: organizationId }),
  });
};
