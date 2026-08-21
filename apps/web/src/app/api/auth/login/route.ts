import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api/base-url';
import { setRefreshCookie } from '@/lib/auth/refresh-cookie';
import type { LoginResult } from '@dondy-elevage/shared-types';

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ message: 'Requête invalide.' }, { status: 400 });
  }

  const apiRes = await fetch(`${getApiBaseUrl()}/auth/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });
  const data = (await apiRes.json().catch(() => undefined)) as LoginResult | undefined;

  if (!apiRes.ok || !data) {
    return NextResponse.json(data ?? { message: 'Échec de connexion.' }, { status: apiRes.status });
  }

  if (!data.requiresTwoFactor) {
    const res = NextResponse.json({ requiresTwoFactor: false, accessToken: data.accessToken });
    setRefreshCookie(res, data.refreshToken);
    return res;
  }

  return NextResponse.json({ requiresTwoFactor: true, challengeToken: data.challengeToken });
}
