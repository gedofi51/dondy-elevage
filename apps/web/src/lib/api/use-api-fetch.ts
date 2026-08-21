'use client';

import { useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch, ApiError, type ApiFetchInit } from './client';

/** Ajoute le cycle 401 -> refresh -> nouvelle tentative (une seule fois)
 * au-dessus de apiFetch — à utiliser dans tous les hooks React Query
 * métier plutôt qu'apiFetch directement. */
export function useApiFetch() {
  const { accessToken, refreshAccessToken, logout } = useAuth();

  return useCallback(
    async <T,>(path: string, init?: ApiFetchInit): Promise<T> => {
      try {
        return await apiFetch<T>(path, accessToken, init);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const fresh = await refreshAccessToken();
          if (fresh) return apiFetch<T>(path, fresh, init);
          await logout();
        }
        throw err;
      }
    },
    [accessToken, refreshAccessToken, logout],
  );
}
