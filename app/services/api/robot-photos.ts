import { apiRequest } from './client';

export type RobotEventImageLinkResponse = {
  id?: number;
  teamNumber?: number;
  eventKey?: string;
  description?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  url?: string | null;
  publicUrl?: string | null;
  public_url?: string | null;
  remoteUrl?: string | null;
  signedUrl?: string | null;
  signed_url?: string | null;
  image?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  [key: string]: unknown;
};

const POSSIBLE_URL_KEYS = [
  'remoteUrl',
  'imageUrl',
  'image_url',
  'url',
  'publicUrl',
  'public_url',
  'signedUrl',
  'signed_url',
];

const normalizeFileUri = (uri: string) => {
  if (/^file:\/\//i.test(uri) || /^content:\/\//i.test(uri)) {
    return uri;
  }

  return `file://${uri.replace(/^\//, '')}`;
};

const tryExtractUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
};

const searchForUrl = (value: unknown, depth = 0): string | null => {
  if (depth > 4) {
    return null;
  }

  const direct = tryExtractUrl(value);

  if (direct) {
    return direct;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  for (const key of POSSIBLE_URL_KEYS) {
    if (key in value) {
      const nested = searchForUrl((value as Record<string, unknown>)[key], depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    const nested = searchForUrl(nestedValue, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
};

export const extractRemoteUrlFromRobotPhotoResponse = (
  response: RobotEventImageLinkResponse | null | undefined,
): string | null => {
  if (!response || typeof response !== 'object') {
    return null;
  }

  return searchForUrl(response);
};

export async function uploadRobotPhoto(
  teamNumber: number,
  fileUri: string,
  description?: string,
): Promise<RobotEventImageLinkResponse> {
  const formData = new FormData();
  const normalizedUri = normalizeFileUri(fileUri);
  const filename = fileUri.split('/').pop() ?? `robot_photo_${Date.now()}.jpg`;

  formData.append(
    'file',
    {
      uri: normalizedUri,
      name: filename,
      type: 'image/jpeg',
    } as any,
  );

  if (description) {
    formData.append('description', description);
  }

  return await apiRequest<RobotEventImageLinkResponse>(`/teams/${teamNumber}/images`, {
    method: 'POST',
    body: formData,
  });
}
