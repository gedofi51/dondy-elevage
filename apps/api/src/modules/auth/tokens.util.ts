import { randomBytes, createHash } from 'node:crypto';

/**
 * Jetons à usage unique (activation, reset mot de passe...) : seul le hash
 * est stocké en base, jamais la valeur en clair — même principe que les
 * refresh tokens. SHA-256 suffit ici (jeton haute entropie côté serveur,
 * pas un mot de passe utilisateur à faible entropie — argon2 reste réservé
 * aux mots de passe).
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
