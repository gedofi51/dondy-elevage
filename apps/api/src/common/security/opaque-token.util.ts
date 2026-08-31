import { randomBytes, createHash } from 'node:crypto';

/**
 * Jetons à usage unique (activation de compte, reset mot de passe, QR
 * Codes...) : seul le hash est stocké en base, jamais la valeur en clair —
 * même principe que les refresh tokens. SHA-256 suffit ici (jeton haute
 * entropie côté serveur, pas un mot de passe utilisateur à faible entropie
 * — argon2 reste réservé aux mots de passe).
 *
 * Déplacé depuis modules/auth/tokens.util.ts (Lot 1 QR Codes) — 3ᵉ usage
 * (auth activation/reset + QR Codes), relocalisé en commun pour éviter la
 * duplication plutôt que copié tel quel dans le nouveau module.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
