import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBaseUrl } from '@/lib/api/base-url';
import { REFRESH_COOKIE_NAME, clearRefreshCookie } from '@/lib/auth/refresh-cookie';

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (refreshToken) {
    // Best-effort : la déconnexion locale (suppression du cookie) doit
    // réussir même si l'API est injoignable ou le token déjà expiré.
    await fetch(`${getApiBaseUrl()}/auth/deconnexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ message: 'Déconnecté.' });
  clearRefreshCookie(res);
  return res;
}
