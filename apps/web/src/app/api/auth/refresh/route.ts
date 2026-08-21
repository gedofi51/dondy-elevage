import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBaseUrl } from '@/lib/api/base-url';
import { REFRESH_COOKIE_NAME, clearRefreshCookie, setRefreshCookie } from '@/lib/auth/refresh-cookie';

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  if (!refreshToken) {
    return NextResponse.json({ message: 'Aucune session.' }, { status: 401 });
  }

  const apiRes = await fetch(`${getApiBaseUrl()}/auth/rafraichir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const data = (await apiRes.json().catch(() => undefined)) as
    | { accessToken: string; refreshToken: string }
    | undefined;

  if (!apiRes.ok || !data) {
    const res = NextResponse.json({ message: 'Session expirée.' }, { status: apiRes.status || 401 });
    clearRefreshCookie(res);
    return res;
  }

  const res = NextResponse.json({ accessToken: data.accessToken });
  setRefreshCookie(res, data.refreshToken);
  return res;
}
