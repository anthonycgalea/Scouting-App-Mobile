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
