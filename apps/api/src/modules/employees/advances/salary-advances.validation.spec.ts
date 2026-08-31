import { ConflictException } from '@nestjs/common';
import { assertAdvanceEditable } from './salary-advances.validation';

describe('assertAdvanceEditable', () => {
  it('autorise la modification tant que deductedInPayrollId est null', () => {
    expect(() => assertAdvanceEditable(null)).not.toThrow();
  });

  it('refuse la modification une fois l’avance déduite d’un relevé', () => {
    expect(() => assertAdvanceEditable('payroll-1')).toThrow(ConflictException);
  });
});
