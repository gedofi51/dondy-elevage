import type { AlertStatus } from '@prisma/client';

/** Volontairement sans dépendance NestJS/Prisma runtime — testable en pur TypeScript. */
export class InvalidAlertTransitionError extends Error {
  constructor(from: AlertStatus, to: AlertStatus) {
    super(`Transition d'alerte invalide : ${from} -> ${to}.`);
    this.name = 'InvalidAlertTransitionError';
  }
}

/**
 * Cycle de vie à 3 états, linéaire, sans retour arrière :
 * CREATED -> TRIGGERED -> ACKNOWLEDGED.
 */
const VALID_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  CREATED: ['TRIGGERED'],
  TRIGGERED: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: [],
};

export function assertValidTransition(from: AlertStatus, to: AlertStatus): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new InvalidAlertTransitionError(from, to);
  }
}
