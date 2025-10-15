import { getBaseApiUrl } from './base';

export type ApiRequestParams = Record<string, string | number | boolean | null | undefined>;

export type ApiRequestOptions = RequestInit & {
  params?: ApiRequestParams;
};

let authorizationToken: string | null = null;

const resolveUrl = (path: string, params?: ApiRequestParams) => {
  const hasProtocol = /^https?:\/\//i.test(path);
  const base = hasProtocol ? '' : getBaseApiUrl().replace(/\/$/, '');
  const normalizedPath = hasProtocol ? path : `${base}/${path.replace(/^\//, '')}`;

  if (!params || Object.keys(params).length === 0) {
    return normalizedPath;
  }

  const url = new URL(normalizedPath);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    url.searchParams.append(key, String(value));
  });

  return url.toString();
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export async function apiRequest<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
  const { params, headers, body, ...rest } = options;
  const url = resolveUrl(path, params);
  const initHeaders = new Headers(headers);

  if (!initHeaders.has('Accept')) {
    initHeaders.set('Accept', 'application/json');
  }

  const isJsonBody = body !== undefined && !(body instanceof FormData);

  if (isJsonBody && !initHeaders.has('Content-Type')) {
    initHeaders.set('Content-Type', 'application/json');
  }

  if (authorizationToken) {
    initHeaders.set('Authorization', `Bearer ${authorizationToken}`);
  }

  if (__DEV__) {
    const method = (rest.method ?? 'GET').toUpperCase();
    const authHeader = initHeaders.get('Authorization');

    if (authHeader) {
      const [, token] = authHeader.split(' ');
      const preview = token ? `${token.slice(0, 8)}…` : 'missing-token';
      console.debug(`[apiRequest] ${method} ${url} → using bearer ${preview}`);
    } else {  
      console.warn(`[apiRequest] ${method} ${url} → no Authorization header set`);
    }
  }

  const response = await fetch(url, {
    body,
    headers: initHeaders,
    ...rest,
  });

  const parsedBody = await parseResponseBody(response);

  if (!response.ok) {
    const errorMessage =
      typeof parsedBody === 'object' && parsedBody !== null && 'message' in parsedBody
        ? String((parsedBody as { message: unknown }).message)
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return parsedBody as TResponse;
}

export const setAuthorizationToken = (token?: string) => {
  authorizationToken = token ?? null;
};
