import type { NextResponse } from 'next/server';

export const REFRESH_COOKIE_NAME = 'refreshToken';

/** Cookie premier-parti (Next.js lui-même l'a posé) — jamais de souci
 * cross-origin puisque seuls les Route Handlers /api/auth/* le lisent.
 * httpOnly : inatteignable en JS, seul rempart contre le vol par XSS du
 * refresh token (rotaté à chaque usage côté API, voir token.service.ts). */
export function setRefreshCookie(res: NextResponse, refreshToken: string): void {
  res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.delete({ name: REFRESH_COOKIE_NAME, path: '/api/auth' });
}
