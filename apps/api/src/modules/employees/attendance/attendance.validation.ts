import { BadRequestException, ConflictException } from '@nestjs/common';
import { AttendanceStatus, EmployeeStatus } from '@prisma/client';
import { RESTRICTED_EMPLOYEE_STATUSES } from '../employees.validation';

/** Format HH:mm strict (24h, zéro-préfixé) — premier champ "heure" du
 * projet à exiger un format précis (tous les autres, ex. Broiler
 * DailyRecord.entryTime/BroilerBatch.arrivalTime, restent du texte libre
 * sans comparaison programmatique). Nécessaire ici, et seulement ici, car
 * la règle métier "checkOut postérieur à checkIn" exige une comparaison
 * fiable — une comparaison lexicographique de deux chaînes HH:mm
 * correctement zéro-préfixées est valide, ce que du texte libre ne
 * garantirait pas. */
export const CHECK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Pure — testée isolément (attendance.validation.spec.ts), même
 * discipline que employees.validation.ts. status PRESENT : checkInTime
 * requis, checkOutTime optionnel (peut être complété plus tard via
 * PATCH). Tout autre statut (ABSENT/CONGE/MALADIE) : ni checkInTime ni
 * checkOutTime ne doivent être renseignés.
 */
export function assertAttendanceTimesConsistent(
  status: AttendanceStatus,
  checkInTime: string | null | undefined,
  checkOutTime: string | null | undefined,
): void {
  if (status === 'PRESENT') {
    if (!checkInTime) {
      throw new BadRequestException('Heure d’arrivée requise pour un statut PRESENT.');
    }
  } else if (checkInTime || checkOutTime) {
    throw new BadRequestException(
      'Heure d’arrivée/de départ non applicable pour ce statut (ABSENT/CONGE/MALADIE).',
    );
  }

  if (checkInTime && checkOutTime && checkOutTime <= checkInTime) {
    throw new BadRequestException('L’heure de départ doit être postérieure à l’heure d’arrivée.');
  }
}

/** "Pointage impossible sur un employé inactif" — même définition
 * d'"inactif" que le Lot 2 (SUSPENDU/DEPART, pas CONGE — un employé en
 * congé reste un employé actif au sens RH). Appliqué uniquement à la
 * création : corriger un pointage passé pour un employé devenu inactif
 * depuis reste autorisé (correction de donnée historique, pas une
 * nouvelle prise de service). */
export function assertEmployeeActiveForNewAttendance(employeeStatus: EmployeeStatus): void {
  if (RESTRICTED_EMPLOYEE_STATUSES.includes(employeeStatus)) {
    throw new ConflictException(
      'Impossible d’enregistrer un pointage pour un employé suspendu ou sorti.',
    );
  }
}
