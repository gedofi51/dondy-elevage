import { NextResponse } from 'next/server';
import { setRefreshCookie } from '@/lib/auth/refresh-cookie';

/** Reçoit les tokens lus depuis l'URL de redirection OAuth (voir
 * AuthController.redirectWithTokens côté API) et les traite exactement
 * comme /api/auth/login : cookie httpOnly pour le refresh, accessToken
 * renvoyé au client. Le nettoyage de l'URL (tokens visibles en clair
 * dans searchParams) est la responsabilité de la page appelante
 * (router.replace immédiat). */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.accessToken !== 'string' || typeof body.refreshToken !== 'string') {
    return NextResponse.json({ message: 'Requête invalide.' }, { status: 400 });
  }

  const res = NextResponse.json({ accessToken: body.accessToken });
  setRefreshCookie(res, body.refreshToken);
  return res;
}
