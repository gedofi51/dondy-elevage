import { getApiBaseUrl } from './base-url';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Erreur API ${status}`);
    this.name = 'ApiError';
  }
}

export interface ApiFetchInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | undefined>;
}

export async function apiFetch<T>(
  path: string,
  accessToken: string | null,
  init: ApiFetchInit = {},
): Promise<T> {
  const base = getApiBaseUrl();
  const url = new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`);
  for (const [key, value] of Object.entries(init.searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const { body, ...rest } = init;
  delete rest.searchParams;
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...rest.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
