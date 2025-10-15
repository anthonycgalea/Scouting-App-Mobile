import { apiRequest } from './client';

export interface UserInfoResponse {
  display_name: string | null;
  [key: string]: unknown;
}

export interface UserEventResponse {
  eventCode?: string | null;
  [key: string]: unknown;
}

export interface UserOrganizationSelectionResponse {
  organizationId?: number | null;
  organization_id?: number | null;
  [key: string]: unknown;
}

export const getUserInfo = async () => {
  return await apiRequest<UserInfoResponse>('/user/info');
};

export const getUserEvent = async () => {
  return await apiRequest<UserEventResponse>('/user/event', {
    method: 'GET',
  });
};

export const getUserOrganization = async () => {
  return await apiRequest<UserOrganizationSelectionResponse>('/user/organization', {
    method: 'GET',
  });
};

export const updateUserOrganizationSelection = async (userOrganizationId: number) => {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, 5_000);

  try {
    return await apiRequest<UserOrganizationSelectionResponse>('/user/organization', {
      method: 'PATCH',
      body: JSON.stringify({ user_organization_id: userOrganizationId }),
      signal: abortController.signal,
    });
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new Error('Request timed out after 5 seconds');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
