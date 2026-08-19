import { safeDivide } from '../../../common/calculations/safe-math.util';

/** §5.3 : "Œufs commercialisables = œufs pondus - œufs cassés - œufs rejetés." */
export function computeEggsSellable(
  eggsLaid: number,
  eggsBroken: number,
  eggsRejected: number,
): number {
  return eggsLaid - eggsBroken - eggsRejected;
}

/** §5.3 : "Taux de ponte (%) = œufs pondus / nombre de poules présentes × 100." */
export function computeLayingRatePercent(eggsLaid: number, henCount: number): number {
  return safeDivide(eggsLaid, henCount) * 100;
}
