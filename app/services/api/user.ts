import { apiRequest } from './client';

export interface UserInfoResponse {
  display_name: string | null;
  [key: string]: unknown;
}

export const getUserInfo = async () => {
  return await apiRequest<UserInfoResponse>('/user/info');
};
