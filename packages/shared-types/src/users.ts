// Miroir de PublicUser (apps/api/src/modules/users/users.service.ts,
// dérivé de publicUserSelect) — jamais passwordHash ni les champs
// sensibles d'authentification.
export interface PublicUserRole {
  id: string;
  name: string;
}

export type UserStatus = 'INVITED' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface PublicUser {
  id: string;
  farmId: string;
  email: string;
  name: string;
  status: UserStatus;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  userRoles: Array<{ role: PublicUserRole }>;
}

/** POST /users — écran Utilisateurs (Administration). Volontairement SANS
 * champ mot de passe : la création vaut invitation par email
 * (`authService.issueInvitation`, déjà câblé côté API) — l'utilisateur
 * définit lui-même son mot de passe via /activer-compte, jamais saisi
 * par l'administrateur (voir DETTE_TECHNIQUE.md, investigation
 * préalable à cet écran). */
export interface CreateUserInput {
  email: string;
  name: string;
  /** Au moins 1 — l'API accepte plusieurs rôles par utilisateur
   * (ArrayMinSize(1), pas un maximum de 1), reflété tel quel ici plutôt
   * que restreint arbitrairement à un choix unique côté frontend. */
  roleIds: string[];
}

/** PATCH /users/:id. `status` gère l'activation/désactivation — jamais de
 * suppression (aucun DELETE exposé par UsersController). */
export interface UpdateUserInput {
  name?: string;
  status?: UserStatus;
  roleIds?: string[];
}
