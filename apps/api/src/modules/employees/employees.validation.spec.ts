import { BadRequestException, ConflictException } from '@nestjs/common';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import { assertDatesConsistent, assertUpdateAllowed } from './employees.validation';

describe('assertUpdateAllowed', () => {
  it.each(['ACTIF', 'CONGE'] as const)(
    'laisse passer n’importe quel PATCH quand le statut courant est %s',
    (status) => {
      expect(() => assertUpdateAllowed(status, { name: 'Nouveau nom' })).not.toThrow();
    },
  );

  it.each(['SUSPENDU', 'DEPART'] as const)(
    'refuse un PATCH qui ne réactive pas explicitement quand le statut courant est %s',
    (status) => {
      const dto: UpdateEmployeeDto = { name: 'Nouveau nom' };
      expect(() => assertUpdateAllowed(status, dto)).toThrow(ConflictException);
    },
  );

  it.each(['SUSPENDU', 'DEPART'] as const)(
    'autorise le PATCH de réactivation explicite (status: ACTIF) quand le statut courant est %s',
    (status) => {
      const dto: UpdateEmployeeDto = { status: 'ACTIF' };
      expect(() => assertUpdateAllowed(status, dto)).not.toThrow();
    },
  );

  it('refuse une tentative de repasser de SUSPENDU à DEPART sans passer par ACTIF', () => {
    const dto: UpdateEmployeeDto = { status: 'DEPART' };
    expect(() => assertUpdateAllowed('SUSPENDU', dto)).toThrow(ConflictException);
  });

  it("autorise d'autres changements de champs dans le même PATCH que la réactivation", () => {
    const dto: UpdateEmployeeDto = { status: 'ACTIF', position: 'Nouveau poste' };
    expect(() => assertUpdateAllowed('DEPART', dto)).not.toThrow();
  });
});

describe('assertDatesConsistent', () => {
  it('ne lève rien si endDate est absent', () => {
    expect(() => assertDatesConsistent(new Date('2026-01-01'), null)).not.toThrow();
    expect(() => assertDatesConsistent(new Date('2026-01-01'), undefined)).not.toThrow();
  });

  it('ne lève rien si endDate est postérieur ou égal à hireDate', () => {
    const hireDate = new Date('2026-01-01');
    expect(() => assertDatesConsistent(hireDate, new Date('2026-06-01'))).not.toThrow();
    expect(() => assertDatesConsistent(hireDate, new Date('2026-01-01'))).not.toThrow();
  });

  it('lève BadRequestException si endDate précède hireDate', () => {
    const hireDate = new Date('2026-06-01');
    expect(() => assertDatesConsistent(hireDate, new Date('2026-01-01'))).toThrow(
      BadRequestException,
    );
  });
});
