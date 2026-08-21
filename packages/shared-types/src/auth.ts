// Miroir de apps/api/src/modules/auth/jwt-payload.interface.ts — types
// décodés du JWT d'accès, utilisés côté front pour le gating UI (jamais
// pour l'autorisation réelle, qui reste 100% côté API/PermissionsGuard).

export interface AccessTokenPayload {
  sub: string;
  farmId: string;
  roles: string[];
  permissions: string[];
  type: 'access';
}

export interface TwoFactorChallengePayload {
  sub: string;
  type: 'two_factor_challenge';
}

// Miroir de AuthService.LoginResult (apps/api/src/modules/auth/auth.service.ts).
export type LoginResult =
  | { requiresTwoFactor: true; challengeToken: string }
  | { requiresTwoFactor: false; accessToken: string; refreshToken: string };
