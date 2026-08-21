'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AccessTokenPayload } from '@dondy-elevage/shared-types';
import { decodeAccessToken } from '@/lib/auth/jwt';
import * as authClient from '@/lib/auth/auth-client';

interface AuthContextValue {
  accessToken: string | null;
  user: AccessTokenPayload | null;
  /** true tant que la tentative de rafraîchissement silencieux (montage)
   * n'a pas résolu — évite un flash "non connecté" avant hydratation. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<authClient.LoginResponse>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<void>;
  completeOauthCallback: (accessToken: string, refreshToken: string) => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authClient.refreshAccessToken().then((result) => {
      if (!cancelled) {
        setAccessToken(result?.accessToken ?? null);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authClient.login(email, password);
    if (!result.requiresTwoFactor && result.accessToken) {
      setAccessToken(result.accessToken);
    }
    return result;
  }, []);

  const verifyTwoFactor = useCallback(async (challengeToken: string, code: string) => {
    const result = await authClient.verifyTwoFactor(challengeToken, code);
    setAccessToken(result.accessToken);
  }, []);

  const completeOauthCallback = useCallback(async (accessTokenValue: string, refreshTokenValue: string) => {
    const result = await authClient.completeOauthCallback(accessTokenValue, refreshTokenValue);
    setAccessToken(result.accessToken);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const result = await authClient.refreshAccessToken();
    setAccessToken(result?.accessToken ?? null);
    return result?.accessToken ?? null;
  }, []);

  const logout = useCallback(async () => {
    await authClient.logoutRequest().catch(() => undefined);
    setAccessToken(null);
  }, []);

  const user = useMemo(() => (accessToken ? decodeAccessToken(accessToken) : null), [accessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user,
      isLoading,
      login,
      verifyTwoFactor,
      completeOauthCallback,
      refreshAccessToken,
      logout,
    }),
    [accessToken, user, isLoading, login, verifyTwoFactor, completeOauthCallback, refreshAccessToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous AuthProvider.');
  return ctx;
}
