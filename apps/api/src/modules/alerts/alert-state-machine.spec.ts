import type { AlertStatus } from '@prisma/client';
import { assertValidTransition, InvalidAlertTransitionError } from './alert-state-machine';

describe('assertValidTransition', () => {
  const ALL_STATUSES: AlertStatus[] = ['CREATED', 'TRIGGERED', 'ACKNOWLEDGED'];

  it.each([
    ['CREATED', 'TRIGGERED'],
    ['TRIGGERED', 'ACKNOWLEDGED'],
  ] as const)('autorise %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).not.toThrow();
  });

  const VALID_PAIRS = new Set(['CREATED->TRIGGERED', 'TRIGGERED->ACKNOWLEDGED']);

  it('rejette toute autre paire de transition', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const pair = `${from}->${to}`;
        if (VALID_PAIRS.has(pair)) {
          continue;
        }
        expect(() => assertValidTransition(from, to)).toThrow(InvalidAlertTransitionError);
      }
    }
  });

  it('rejette une régression (ACKNOWLEDGED -> TRIGGERED)', () => {
    expect(() => assertValidTransition('ACKNOWLEDGED', 'TRIGGERED')).toThrow(
      InvalidAlertTransitionError,
    );
  });

  it("rejette un saut d'étape (CREATED -> ACKNOWLEDGED)", () => {
    expect(() => assertValidTransition('CREATED', 'ACKNOWLEDGED')).toThrow(
      InvalidAlertTransitionError,
    );
  });

  it('rejette le statu quo (aucun état ne se transitionne vers lui-même)', () => {
    for (const status of ALL_STATUSES) {
      expect(() => assertValidTransition(status, status)).toThrow(InvalidAlertTransitionError);
    }
  });
});
