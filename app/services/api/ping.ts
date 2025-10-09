import { apiRequest } from './client';

export type PingResponse = {
  message: string;
};

export const pingBackend = async () => {
  return apiRequest<PingResponse>('/ping', {
    method: 'GET',
  });
};
