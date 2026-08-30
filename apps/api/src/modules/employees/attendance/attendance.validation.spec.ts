import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  assertAttendanceTimesConsistent,
  assertEmployeeActiveForNewAttendance,
  CHECK_TIME_PATTERN,
} from './attendance.validation';

describe('assertAttendanceTimesConsistent', () => {
  it('exige checkInTime pour un statut PRESENT', () => {
    expect(() => assertAttendanceTimesConsistent('PRESENT', undefined, undefined)).toThrow(
      BadRequestException,
    );
    expect(() => assertAttendanceTimesConsistent('PRESENT', null, null)).toThrow(
      BadRequestException,
    );
  });

  it('accepte PRESENT avec seulement checkInTime (checkOutTime complété plus tard)', () => {
    expect(() => assertAttendanceTimesConsistent('PRESENT', '08:00', undefined)).not.toThrow();
  });

  it('accepte PRESENT avec checkInTime et checkOutTime cohérents', () => {
    expect(() => assertAttendanceTimesConsistent('PRESENT', '08:00', '17:00')).not.toThrow();
  });

  it('refuse checkOutTime antérieur ou égal à checkInTime', () => {
    expect(() => assertAttendanceTimesConsistent('PRESENT', '17:00', '08:00')).toThrow(
      BadRequestException,
    );
    expect(() => assertAttendanceTimesConsistent('PRESENT', '08:00', '08:00')).toThrow(
      BadRequestException,
    );
  });

  it.each(['ABSENT', 'CONGE', 'MALADIE'] as const)(
    'refuse checkInTime/checkOutTime pour le statut %s',
    (status) => {
      expect(() => assertAttendanceTimesConsistent(status, '08:00', undefined)).toThrow(
        BadRequestException,
      );
      expect(() => assertAttendanceTimesConsistent(status, undefined, '17:00')).toThrow(
        BadRequestException,
      );
    },
  );

  it.each(['ABSENT', 'CONGE', 'MALADIE'] as const)(
    'accepte le statut %s sans checkInTime ni checkOutTime',
    (status) => {
      expect(() => assertAttendanceTimesConsistent(status, undefined, undefined)).not.toThrow();
      expect(() => assertAttendanceTimesConsistent(status, null, null)).not.toThrow();
    },
  );
});

describe('assertEmployeeActiveForNewAttendance', () => {
  it.each(['ACTIF', 'CONGE'] as const)(
    'autorise un nouveau pointage pour le statut %s',
    (status) => {
      expect(() => assertEmployeeActiveForNewAttendance(status)).not.toThrow();
    },
  );

  it.each(['SUSPENDU', 'DEPART'] as const)(
    'refuse un nouveau pointage pour le statut %s',
    (status) => {
      expect(() => assertEmployeeActiveForNewAttendance(status)).toThrow(ConflictException);
    },
  );
});

describe('CHECK_TIME_PATTERN', () => {
  it.each(['00:00', '08:30', '23:59', '17:00'])('accepte le format HH:mm valide %s', (value) => {
    expect(CHECK_TIME_PATTERN.test(value)).toBe(true);
  });

  it.each(['24:00', '08:60', '8:30', '17h00', ''])('refuse le format invalide %s', (value) => {
    expect(CHECK_TIME_PATTERN.test(value)).toBe(false);
  });
});
