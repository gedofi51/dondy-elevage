import { BadRequestException, ConflictException } from '@nestjs/common';
import { assertPayrollEditable, assertPeriodValid } from './payroll.validation';

describe('assertPayrollEditable', () => {
  it('autorise la modification tant que le statut est BROUILLON', () => {
    expect(() => assertPayrollEditable('BROUILLON')).not.toThrow();
  });

  it('refuse toute modification une fois VALIDE', () => {
    expect(() => assertPayrollEditable('VALIDE')).toThrow(ConflictException);
  });
});

describe('assertPeriodValid', () => {
  it('ne lève rien si periodEnd est postérieur ou égal à periodStart', () => {
    const start = new Date('2026-01-01');
    expect(() => assertPeriodValid(start, new Date('2026-01-31'))).not.toThrow();
    expect(() => assertPeriodValid(start, start)).not.toThrow();
  });

  it('lève BadRequestException si periodEnd précède periodStart', () => {
    const start = new Date('2026-01-31');
    expect(() => assertPeriodValid(start, new Date('2026-01-01'))).toThrow(BadRequestException);
  });
});
