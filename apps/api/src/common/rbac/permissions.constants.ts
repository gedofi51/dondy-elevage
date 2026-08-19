/**
 * Catalogue des permissions — RBAC piloté par données (voir schema.prisma,
 * modèles Role/Permission/RolePermission). Cette liste n'est PAS un enum
 * métier figé : elle décrit seulement les codes que le code applicatif
 * connaît et vérifie via PermissionsGuard. Étendue phase après phase, en
 * même temps que les modules métier correspondants.
 *
 * `platform.manage` est un cas particulier : réservé au rôle système
 * Super Admin, il autorise les opérations transverses à toutes les fermes
 * (ex. création d'une nouvelle ferme) — jamais accordé à un rôle de ferme.
 */
export const PERMISSIONS = {
  PLATFORM_MANAGE: 'platform.manage',

  FARMS_READ: 'farms.read',
  FARMS_UPDATE: 'farms.update',

  BUILDINGS_CREATE: 'buildings.create',
  BUILDINGS_READ: 'buildings.read',
  BUILDINGS_UPDATE: 'buildings.update',
  BUILDINGS_DELETE: 'buildings.delete',

  USERS_CREATE: 'users.create',
  USERS_READ: 'users.read',
  USERS_UPDATE: 'users.update',

  ROLES_READ: 'roles.read',
  ROLES_ASSIGN: 'roles.assign',

  SUPPLIERS_CREATE: 'suppliers.create',
  SUPPLIERS_READ: 'suppliers.read',
  SUPPLIERS_UPDATE: 'suppliers.update',
  SUPPLIERS_DELETE: 'suppliers.delete',

  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',

  DOCUMENTS_CREATE: 'documents.create',
  DOCUMENTS_READ: 'documents.read',
  DOCUMENTS_DELETE: 'documents.delete',

  ALERTS_CREATE: 'alerts.create',
  ALERTS_READ: 'alerts.read',
  ALERTS_ACKNOWLEDGE: 'alerts.acknowledge',

  BROILER_BATCHES_CREATE: 'broiler_batches.create',
  BROILER_BATCHES_READ: 'broiler_batches.read',
  BROILER_BATCHES_UPDATE: 'broiler_batches.update',
  BROILER_BATCHES_DELETE: 'broiler_batches.delete',
  BROILER_BATCHES_CLOSE: 'broiler_batches.close',

  BROILER_DAILY_RECORDS_READ: 'broiler_daily_records.read',
  BROILER_DAILY_RECORDS_UPDATE: 'broiler_daily_records.update',

  BROILER_MORTALITY_CREATE: 'broiler_mortality.create',
  BROILER_MORTALITY_READ: 'broiler_mortality.read',
  BROILER_MORTALITY_UPDATE: 'broiler_mortality.update',
  BROILER_MORTALITY_DELETE: 'broiler_mortality.delete',

  BROILER_HEALTH_EVENTS_CREATE: 'broiler_health_events.create',
  BROILER_HEALTH_EVENTS_READ: 'broiler_health_events.read',
  BROILER_HEALTH_EVENTS_UPDATE: 'broiler_health_events.update',

  EXPENSES_CREATE: 'expenses.create',
  EXPENSES_READ: 'expenses.read',
  EXPENSES_UPDATE: 'expenses.update',
  EXPENSES_DELETE: 'expenses.delete',

  SALES_CREATE: 'sales.create',
  SALES_READ: 'sales.read',
  SALES_UPDATE: 'sales.update',

  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_DELETE: 'payments.delete',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  [PERMISSIONS.PLATFORM_MANAGE]:
    'Opérations transverses à toutes les fermes (réservé au rôle système Super Admin)',
  [PERMISSIONS.FARMS_READ]: 'Consulter les informations de la ferme',
  [PERMISSIONS.FARMS_UPDATE]: 'Modifier les informations/paramètres de la ferme',
  [PERMISSIONS.BUILDINGS_CREATE]: 'Créer un bâtiment',
  [PERMISSIONS.BUILDINGS_READ]: 'Consulter les bâtiments',
  [PERMISSIONS.BUILDINGS_UPDATE]: 'Modifier un bâtiment',
  [PERMISSIONS.BUILDINGS_DELETE]: 'Supprimer un bâtiment',
  [PERMISSIONS.USERS_CREATE]: 'Créer un compte utilisateur (invitation)',
  [PERMISSIONS.USERS_READ]: 'Consulter les utilisateurs de la ferme',
  [PERMISSIONS.USERS_UPDATE]: 'Modifier/désactiver un utilisateur',
  [PERMISSIONS.ROLES_READ]: 'Consulter le référentiel de rôles/permissions',
  [PERMISSIONS.ROLES_ASSIGN]: 'Attribuer/retirer un rôle à un utilisateur',

  [PERMISSIONS.SUPPLIERS_CREATE]: 'Créer un fournisseur',
  [PERMISSIONS.SUPPLIERS_READ]: 'Consulter les fournisseurs',
  [PERMISSIONS.SUPPLIERS_UPDATE]: 'Modifier un fournisseur',
  [PERMISSIONS.SUPPLIERS_DELETE]: 'Supprimer un fournisseur',

  [PERMISSIONS.CUSTOMERS_CREATE]: 'Créer un client',
  [PERMISSIONS.CUSTOMERS_READ]: 'Consulter les clients',
  [PERMISSIONS.CUSTOMERS_UPDATE]: 'Modifier un client',
  [PERMISSIONS.CUSTOMERS_DELETE]: 'Supprimer un client',

  [PERMISSIONS.DOCUMENTS_CREATE]: 'Téléverser un document',
  [PERMISSIONS.DOCUMENTS_READ]: 'Consulter/télécharger les documents',
  [PERMISSIONS.DOCUMENTS_DELETE]: 'Supprimer un document',

  [PERMISSIONS.ALERTS_CREATE]: 'Créer/déclencher une alerte',
  [PERMISSIONS.ALERTS_READ]: 'Consulter les alertes',
  [PERMISSIONS.ALERTS_ACKNOWLEDGE]: 'Acquitter une alerte',

  [PERMISSIONS.BROILER_BATCHES_CREATE]: 'Créer une bande de poulets de chair',
  [PERMISSIONS.BROILER_BATCHES_READ]: 'Consulter les bandes de poulets de chair',
  [PERMISSIONS.BROILER_BATCHES_UPDATE]: 'Modifier une bande de poulets de chair',
  [PERMISSIONS.BROILER_BATCHES_DELETE]:
    'Supprimer une bande (sans activité financière/sanitaire liée)',
  [PERMISSIONS.BROILER_BATCHES_CLOSE]: 'Clôturer une bande',

  [PERMISSIONS.BROILER_DAILY_RECORDS_READ]: 'Consulter le suivi quotidien J1-J45',
  [PERMISSIONS.BROILER_DAILY_RECORDS_UPDATE]: 'Saisir le suivi quotidien J1-J45',

  [PERMISSIONS.BROILER_MORTALITY_CREATE]: 'Enregistrer une mortalité détaillée',
  [PERMISSIONS.BROILER_MORTALITY_READ]: 'Consulter la mortalité détaillée',
  [PERMISSIONS.BROILER_MORTALITY_UPDATE]: 'Modifier une mortalité détaillée',
  [PERMISSIONS.BROILER_MORTALITY_DELETE]: 'Supprimer une mortalité détaillée',

  [PERMISSIONS.BROILER_HEALTH_EVENTS_CREATE]:
    'Créer un événement sanitaire (vaccination, traitement...)',
  [PERMISSIONS.BROILER_HEALTH_EVENTS_READ]: 'Consulter le calendrier sanitaire',
  [PERMISSIONS.BROILER_HEALTH_EVENTS_UPDATE]: 'Modifier un événement sanitaire',

  [PERMISSIONS.EXPENSES_CREATE]: 'Créer une dépense',
  [PERMISSIONS.EXPENSES_READ]: 'Consulter les dépenses',
  [PERMISSIONS.EXPENSES_UPDATE]: 'Modifier une dépense',
  [PERMISSIONS.EXPENSES_DELETE]: 'Supprimer une dépense',

  [PERMISSIONS.SALES_CREATE]: 'Enregistrer une vente',
  [PERMISSIONS.SALES_READ]: 'Consulter les ventes',
  [PERMISSIONS.SALES_UPDATE]: 'Modifier/annuler une vente',

  [PERMISSIONS.PAYMENTS_CREATE]: 'Enregistrer un paiement',
  [PERMISSIONS.PAYMENTS_READ]: 'Consulter les paiements',
  [PERMISSIONS.PAYMENTS_DELETE]: 'Supprimer un paiement (correction)',
};
