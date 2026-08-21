// Miroir de PublicUser (apps/api/src/modules/users/users.service.ts,
// dérivé de publicUserSelect) — jamais passwordHash ni les champs
// sensibles d'authentification.
export interface PublicUserRole {
  id: string;
  name: string;
}

export interface PublicUser {
  id: string;
  farmId: string;
  email: string;
  name: string;
  status: 'INVITED' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  userRoles: Array<{ role: PublicUserRole }>;
}
