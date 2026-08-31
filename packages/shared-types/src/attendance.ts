/**
 * Pointage journalier — sous-ressource d'Employee (`/employees/:id/
 * attendance`, Lot 3 API). Un enregistrement par employé et par jour
 * (contrainte unique(employeeId, date) côté Prisma) ; `checkInTime`/
 * `checkOutTime` au format HH:mm strict (voir CHECK_TIME_PATTERN côté
 * API, apps/api/.../attendance.validation.ts), tous deux `null` sauf pour
 * le statut PRESENT (checkInTime alors requis, checkOutTime optionnel —
 * complétable plus tard via PATCH).
 */
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'CONGE' | 'MALADIE';

export interface Attendance {
  id: string;
  farmId: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** `date`/`employeeId` absents des champs éditables : `employeeId` est
 * porté par la route, `date` est immuable après création (voir
 * UpdateAttendanceDto côté API) — un `date` est donc bien requis à la
 * création uniquement. */
export interface CreateAttendanceInput {
  date: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  observations?: string;
}

export interface UpdateAttendanceInput {
  status?: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  observations?: string;
}
