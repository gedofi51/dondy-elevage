import { z } from 'zod';
import { EMPLOYEE_TASK_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';

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

// Pointage (Lot 6b) — statuts réels uniquement, miroir de AttendanceStatus
// (packages/shared-types/src/attendance.ts) et du enum Prisma.
export const attendanceStatusOptions = ['PRESENT', 'ABSENT', 'CONGE', 'MALADIE'] as const;

export const attendanceStatusLabels: Record<(typeof attendanceStatusOptions)[number], string> = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  CONGE: 'En congé',
  MALADIE: 'Maladie',
};

const attendanceTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Miroir front d'assertAttendanceTimesConsistent (apps/api/.../
 * attendance.validation.ts) — retour immédiat côté formulaire, jamais la
 * seule barrière : le serveur revalide intégralement à chaque écriture. */
export const attendanceFormSchema = z
  .object({
    status: z.enum(attendanceStatusOptions),
    checkInTime: z
      .string()
      .regex(attendanceTimePattern, 'Format HH:mm requis.')
      .optional()
      .or(z.literal('')),
    checkOutTime: z
      .string()
      .regex(attendanceTimePattern, 'Format HH:mm requis.')
      .optional()
      .or(z.literal('')),
    observations: z.string().max(2000).optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    if (values.status === 'PRESENT') {
      if (!values.checkInTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['checkInTime'],
          message: 'Heure d’arrivée requise pour un statut Présent.',
        });
      }
    } else if (values.checkInTime || values.checkOutTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkInTime'],
        message: 'Heure d’arrivée/de départ non applicable pour ce statut.',
      });
    }
    if (values.checkInTime && values.checkOutTime && values.checkOutTime <= values.checkInTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkOutTime'],
        message: 'L’heure de départ doit être postérieure à l’heure d’arrivée.',
      });
    }
  });
export type AttendanceFormInput = z.input<typeof attendanceFormSchema>;
export type AttendanceFormValues = z.output<typeof attendanceFormSchema>;

// Tâches assignées (Lot 6c) — miroir de CreateEmployeeTaskDto/
// UpdateEmployeeTaskDto (apps/api/.../employee-tasks). `status` absent du
// schéma de création : toujours A_FAIRE par défaut côté API.
export const createEmployeeTaskSchema = z.object({
  designation: z.string().min(1, 'Désignation requise').max(191),
  dueDate: z.string().min(1, 'Échéance requise'),
  observations: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateEmployeeTaskFormInput = z.input<typeof createEmployeeTaskSchema>;
export type CreateEmployeeTaskFormValues = z.output<typeof createEmployeeTaskSchema>;

// `status` restreint aux 3 valeurs "libres" (EMPLOYEE_TASK_EDITABLE_
// STATUSES) — ANNULEE reste exclusivement accessible via l'endpoint
// /annuler dédié, jamais ce PATCH générique (interdiction explicite du
// Lot 6c, même discipline que MaintenanceTask).
export const updateEmployeeTaskSchema = z.object({
  designation: z.string().min(1, 'Désignation requise').max(191),
  dueDate: z.string().min(1, 'Échéance requise'),
  status: z.enum(EMPLOYEE_TASK_EDITABLE_STATUSES),
  observations: z.string().max(2000).optional().or(z.literal('')),
});
export type UpdateEmployeeTaskFormInput = z.input<typeof updateEmployeeTaskSchema>;
export type UpdateEmployeeTaskFormValues = z.output<typeof updateEmployeeTaskSchema>;

// Motif obligatoire — règle UI explicite du Lot 6c, plus stricte que le
// DTO API (CancelEmployeeTaskDto.cancelReason est optionnel côté
// serveur, même forme que CancelMaintenanceTaskDto) : imposé ici pour la
// qualité de la donnée d'audit, sans modification backend (une chaîne
// non vide reste toujours valide pour un champ optionnel côté API).
export const cancelEmployeeTaskSchema = z.object({
  cancelReason: z.string().min(1, 'Motif requis').max(1000),
});
export type CancelEmployeeTaskFormInput = z.input<typeof cancelEmployeeTaskSchema>;
export type CancelEmployeeTaskFormValues = z.output<typeof cancelEmployeeTaskSchema>;
