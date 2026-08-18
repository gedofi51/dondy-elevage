export interface AccessTokenPayload {
  sub: string; // userId
  farmId: string;
  roles: string[]; // noms de rôles, informatif
  permissions: string[]; // codes de permission — source de vérité pour PermissionsGuard
  type: 'access';
}

/**
 * Émis à la place d'un access token complet quand l'utilisateur a la 2FA
 * activée : ne donne accès à rien d'autre qu'à POST /auth/2fa/verifier.
 */
export interface TwoFactorChallengePayload {
  sub: string; // userId
  type: 'two_factor_challenge';
}
