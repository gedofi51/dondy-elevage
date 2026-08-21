/** Wrappers fins vers les Route Handlers Next.js sous app/api/auth/ — même
 * origine, jamais l'API NestJS directement (voir les fichiers route.ts
 * correspondants pour la gestion du cookie httpOnly du refresh token). */

export interface LoginResponse {
  requiresTwoFactor: boolean;
  accessToken?: string;
  challengeToken?: string;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const data = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message = (data as { message?: string } | undefined)?.message ?? 'Échec de la requête.';
    throw new Error(message);
  }
  return data as T;
}

export function login(email: string, password: string) {
  return postJson<LoginResponse>('/api/auth/login', { email, password });
}

export function verifyTwoFactor(challengeToken: string, code: string) {
  return postJson<{ accessToken: string }>('/api/auth/2fa-verify', { challengeToken, code });
}

let inFlightRefresh: Promise<{ accessToken: string } | null> | null = null;

/** Dédoublonne les appels concurrents vers un seul POST /api/auth/refresh
 * réel. Nécessaire : le refresh token est à usage unique côté API, avec
 * révocation de toute la famille de tokens en cas de réutilisation
 * détectée (voir TokenService.rotateRefreshToken) — deux appels
 * simultanés (ex. double montage React StrictMode, ou l'effet de
 * montage d'AuthProvider chevauchant une reprise sur 401 côté
 * useApiFetch) enverraient chacun le MÊME cookie, le second serait alors
 * traité comme une réutilisation et invaliderait la session entière. */
export function refreshAccessToken(): Promise<{ accessToken: string } | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = postJson<{ accessToken: string }>('/api/auth/refresh')
      .catch(() => null)
      .finally(() => {
        inFlightRefresh = null;
      });
  }
  return inFlightRefresh;
}

export function logoutRequest() {
  return postJson<void>('/api/auth/logout');
}

export function completeOauthCallback(accessToken: string, refreshToken: string) {
  return postJson<{ accessToken: string }>('/api/auth/oauth-callback', {
    accessToken,
    refreshToken,
  });
}
