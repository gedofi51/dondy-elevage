import type { AccessTokenPayload } from '@dondy-elevage/shared-types';

/** Décodage du payload JWT côté client, SANS vérification de signature —
 * uniquement pour piloter l'affichage (gating UI). L'application réelle
 * des permissions reste 100% côté API (PermissionsGuard). Ne jamais
 * faire confiance à ce décodage pour une décision de sécurité.
 *
 * `atob()` décode le base64 en "chaîne binaire" : un caractère JS par
 * OCTET décodé, jamais du texte Unicode. Le payload JWT (roles, noms
 * d'utilisateur potentiels...) est en UTF-8 — un caractère accentué
 * (ex. "é", 2 octets 0xC3 0xA9 en UTF-8) ressortait donc corrompu en 2
 * caractères Latin-1 séparés si on passait `atob()` directement à
 * `JSON.parse` ("é" → "Ã©", le mojibake observé sur tout affichage de nom
 * de rôle). Cause confirmée par la donnée réelle : le catalogue de rôles
 * (roles.catalog.ts) et son stockage MySQL (`SHOW CREATE TABLE roles` →
 * utf8mb4, octets bruts déjà corrects en base) sont tous deux propres —
 * seul ce décodage était fautif (voir DETTE_TECHNIQUE.md). `TextDecoder`
 * réinterprète correctement la chaîne binaire d'`atob()` comme des octets
 * UTF-8 avant de parser le JSON — seule correction nécessaire, aucune
 * donnée en base n'était à corriger. */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(base64);
    const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}
