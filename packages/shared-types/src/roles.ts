/** Miroir de RolesService.findAll() (apps/api/src/modules/roles) — le
 * catalogue de rôles système (farmId=null), disponible à toute ferme,
 * jamais les permissions détaillées (GET /roles ne les expose pas). */
export interface Role {
  id: string;
  name: string;
  isSystem: boolean;
}
