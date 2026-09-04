import { describe, expect, it } from 'vitest';
import type { AccessTokenPayload } from '@dondy-elevage/shared-types';
import { decodeAccessToken } from './jwt';

/** Construit un faux JWT (header.payload.signature, signature non
 * vérifiée par decodeAccessToken) en base64url — même format que
 * `@nestjs/jwt` côté serveur. */
function fakeToken(payload: unknown): string {
  const base64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.signature-non-verifiee`;
}

describe('decodeAccessToken', () => {
  it('décode correctement les caractères accentués du payload (regression — mojibake atob())', () => {
    const payload: AccessTokenPayload = {
      sub: 'user-1',
      farmId: 'farm-1',
      roles: ['Propriétaire / Administrateur'],
      permissions: ['farms.read'],
      type: 'access',
    };
    const decoded = decodeAccessToken(fakeToken(payload));
    // Avant le correctif, atob() seul aurait produit "PropriÃ©taire...".
    expect(decoded?.roles[0]).toBe('Propriétaire / Administrateur');
  });

  it('décode un payload sans caractère accentué (cas simple)', () => {
    const payload: AccessTokenPayload = {
      sub: 'user-2',
      farmId: 'farm-1',
      roles: ['Vendeur / Caisse'],
      permissions: [],
      type: 'access',
    };
    const decoded = decodeAccessToken(fakeToken(payload));
    expect(decoded).toEqual(payload);
  });

  it('renvoie null pour un token malformé (pas de segment payload)', () => {
    expect(decodeAccessToken('un-seul-segment')).toBeNull();
  });

  it('renvoie null pour un payload qui n’est pas du JSON valide', () => {
    const bogus = `header.${Buffer.from('pas-du-json', 'utf8').toString('base64url')}.sig`;
    expect(decodeAccessToken(bogus)).toBeNull();
  });
});
