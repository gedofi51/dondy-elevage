import type { AccessTokenPayload } from '@dondy-elevage/shared-types';

/** Décodage du payload JWT côté client, SANS vérification de signature —
 * uniquement pour piloter l'affichage (gating UI). L'application réelle
 * des permissions reste 100% côté API (PermissionsGuard). Ne jamais
 * faire confiance à ce décodage pour une décision de sécurité. */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}
