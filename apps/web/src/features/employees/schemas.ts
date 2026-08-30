import { z } from 'zod';

export const employeeStatusOptions = ['ACTIF', 'CONGE', 'SUSPENDU', 'DEPART'] as const;

export const employeeStatusLabels: Record<(typeof employeeStatusOptions)[number], string> = {
  ACTIF: 'Actif',
  CONGE: 'En congé',
  SUSPENDU: 'Suspendu',
  DEPART: 'Sorti',
};

// Base commune création/édition — miroir de CreateEmployeeDto/UpdateEmployeeDto.
const employeeBaseFields = {
  buildingId: z.string().optional().or(z.literal('')),
  managerId: z.string().optional().or(z.literal('')),
  name: z.string().min(1, 'Nom requis').max(191),
  position: z.string().min(1, 'Poste requis').max(191),
  contractType: z.string().max(191).optional().or(z.literal('')),
  phone: z.string().max(191).optional().or(z.literal('')),
  hireDate: z.string().min(1, 'Date d’embauche requise'),
  endDate: z.string().optional().or(z.literal('')),
  observations: z.string().max(2000).optional().or(z.literal('')),
};

export const createEmployeeSchema = z.object({
  ...employeeBaseFields,
  baseSalaryFcfa: z.coerce.number().int('Nombre entier').min(0, 'Doit être positif ou nul'),
});
export type CreateEmployeeFormInput = z.input<typeof createEmployeeSchema>;
export type CreateEmployeeFormValues = z.output<typeof createEmployeeSchema>;

/** `status` accepte les 4 valeurs — voir shared-types/employees.ts : la
 * restriction "réactivation explicite si SUSPENDU/DEPART" est un
 * contrôle dynamique côté service (dépend de l'état courant), pas une
 * liste statique comme ASSET_EDITABLE_STATUSES. `baseSalaryFcfa`
 * optionnel dans CE schéma (defaultValue défensif si jamais absent),
 * même si en pratique tout rôle pouvant éditer a aussi
 * EMPLOYEES_VIEW_SALARY dans la matrice RBAC actuelle. */
export const updateEmployeeSchema = z.object({
  ...employeeBaseFields,
  status: z.enum(employeeStatusOptions),
  baseSalaryFcfa: z.coerce
    .number()
    .int('Nombre entier')
    .min(0, 'Doit être positif ou nul')
    .optional(),
});
export type UpdateEmployeeFormInput = z.input<typeof updateEmployeeSchema>;
export type UpdateEmployeeFormValues = z.output<typeof updateEmployeeSchema>;
