import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api/base-url';
import { setRefreshCookie } from '@/lib/auth/refresh-cookie';
import type { LoginResult } from '@dondy-elevage/shared-types';

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.challengeToken !== 'string' || typeof body.code !== 'string') {
    return NextResponse.json({ message: 'Requête invalide.' }, { status: 400 });
  }

  const apiRes = await fetch(`${getApiBaseUrl()}/auth/2fa/verifier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken: body.challengeToken, code: body.code }),
  });
  const data = (await apiRes.json().catch(() => undefined)) as LoginResult | undefined;

  if (!apiRes.ok || !data || data.requiresTwoFactor) {
    return NextResponse.json(data ?? { message: 'Code invalide.' }, { status: apiRes.status || 400 });
  }

  const res = NextResponse.json({ accessToken: data.accessToken });
  setRefreshCookie(res, data.refreshToken);
  return res;
}
