import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { TokenService } from '../src/modules/auth/token.service';
import { ROLES_CATALOG } from '../src/common/rbac/roles.catalog';
import {
  body,
  closeAppSafely,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Module Attendance (Personnel — Lot 3) : pointage nesté sous Employee
 * (/employees/:employeeId/attendance), CRUD (POST/GET/PATCH, pas de
 * DELETE — append-only), RBAC, isolation farmId. Même pattern que
 * employees.e2e-spec.ts, y compris le contournement du throttle login
 * (voir son commentaire d'en-tête pour le détail).
 */
jest.setTimeout(30_000);

interface EmployeeResponseBody {
  id: string;
  farmId: string;
  status: string;
}

interface AttendanceResponseBody {
  id: string;
  farmId: string;
  employeeId: string;
  date: string;
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
}

const FULL_ACCESS_ROLE_NAMES = [
  'Propriétaire / Administrateur',
  'Gérant / Responsable ferme',
  'Responsable élevage',
] as const;
const READ_ONLY_ROLE_NAMES = [
  'Comptable / Responsable financier',
  'Lecteur / Lecture seule',
] as const;
const NO_ACCESS_ROLE_NAMES = [
  'Responsable couvoir',
  'Responsable eau',
  'Magasinier / Responsable stocks',
  'Vendeur / Caisse',
  'Employé',
] as const;

describe('Attendance — CRUD, RBAC et isolation farmId (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let tokenService: TokenService;

  let farmA: { id: string };
  let farmB: { id: string };
  let roleIdByName: Map<string, string>;
  const permissionsByRoleName = new Map(ROLES_CATALOG.map((r) => [r.name, r.permissions]));

  const createdUserIds: string[] = [];
  const createdEmployeeIds: string[] = [];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    tokenService = app.get(TokenService);

    const roles = await prisma.role.findMany({ where: { farmId: null } });
    roleIdByName = new Map(roles.map((r) => [r.name, r.id]));
    const requiredRoleNames = [
      ...FULL_ACCESS_ROLE_NAMES,
      ...READ_ONLY_ROLE_NAMES,
      ...NO_ACCESS_ROLE_NAMES,
    ];
    for (const name of requiredRoleNames) {
      if (!roleIdByName.has(name)) {
        throw new Error(`Rôle "${name}" introuvable — lancer \`npm run db:seed\` avant les tests.`);
      }
    }

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (attendance e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (attendance e2e ${Date.now()})` },
    });
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.attendance.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.employee.deleteMany({ where: { id: { in: createdEmployeeIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  /** Utilisateur réel créé en base + token signé directement via
   * TokenService — voir employees.e2e-spec.ts pour la justification
   * complète (throttle de 10 connexions/15min sur /auth/connexion). */
  async function mintToken(farmId: string, roleName: string): Promise<string> {
    const roleId = roleIdByName.get(roleName)!;
    const permissions = permissionsByRoleName.get(roleName)!;
    const { id } = await createActiveUser(
      prisma,
      passwordService,
      farmId,
      roleId,
      'UnusedPassword!2026',
    );
    createdUserIds.push(id);
    return tokenService.signAccessToken({ sub: id, farmId, roles: [roleName], permissions });
  }

  async function createEmployee(
    token: string,
    farmId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<EmployeeResponseBody> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Employé Test Attendance',
        position: 'Ouvrier',
        hireDate: '2026-01-01',
        baseSalaryFcfa: 50_000,
        ...overrides,
      })
      .expect(201);
    const employee = body<EmployeeResponseBody>(res);
    createdEmployeeIds.push(employee.id);
    return employee;
  }

  let ownerAToken: string;
  let employeeA: EmployeeResponseBody;

  it('un Propriétaire peut se connecter via /auth/connexion (vrai flux HTTP) et son token porte ATTENDANCE_CREATE', async () => {
    const password = 'OwnerAttTest!2026';
    const roleId = roleIdByName.get('Propriétaire / Administrateur')!;
    const { id, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleId,
      password,
    );
    createdUserIds.push(id);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password })
      .expect(200);
    ownerAToken = body<LoginResponseBody>(res).accessToken!;

    employeeA = await createEmployee(ownerAToken, farmA.id);

    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/attendance`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ date: '2026-02-01', status: 'PRESENT', checkInTime: '08:00' })
      .expect(201);
  });

  it('complète le checkOutTime via PATCH (pointage en 2 temps)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeA.id}/attendance/2026-02-01`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ checkOutTime: '17:00' })
      .expect(200);
    const attendance = body<AttendanceResponseBody>(res);
    expect(attendance.checkInTime).toBe('08:00');
    expect(attendance.checkOutTime).toBe('17:00');
  });

  it('refuse un second pointage pour le même employé à la même date (409)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/attendance`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ date: '2026-02-01', status: 'PRESENT', checkInTime: '09:00' })
      .expect(409);
  });

  it('refuse checkOutTime antérieur à checkInTime (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/attendance`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ date: '2026-02-02', status: 'PRESENT', checkInTime: '17:00', checkOutTime: '08:00' })
      .expect(400);
  });

  it('refuse checkInTime pour un statut ABSENT (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/attendance`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ date: '2026-02-03', status: 'ABSENT', checkInTime: '08:00' })
      .expect(400);
  });

  it('accepte un statut ABSENT sans checkInTime ni checkOutTime', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/attendance`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ date: '2026-02-03', status: 'ABSENT' })
      .expect(201);
  });

  describe('Pointage impossible sur un employé inactif', () => {
    let suspendedEmployee: EmployeeResponseBody;

    beforeAll(async () => {
      suspendedEmployee = await createEmployee(ownerAToken, farmA.id, {
        name: 'Employé Suspendu Test',
      });
      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${suspendedEmployee.id}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ status: 'SUSPENDU' })
        .expect(200);
    });

    it('refuse un nouveau pointage (409)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/employees/${suspendedEmployee.id}/attendance`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ date: '2026-02-05', status: 'PRESENT', checkInTime: '08:00' })
        .expect(409);
      expect(body<ErrorResponseBody>(res).message).toContain('suspendu');
    });
  });

  describe('RBAC — chaque rôle de la matrice testé', () => {
    it.each(FULL_ACCESS_ROLE_NAMES)('%s : accès complet (create/read/update)', async (roleName) => {
      const token = await mintToken(farmA.id, roleName);
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeA.id}/attendance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: `2026-03-${String(FULL_ACCESS_ROLE_NAMES.indexOf(roleName) + 1).padStart(2, '0')}`,
          status: 'PRESENT',
          checkInTime: '08:00',
        })
        .expect(201);
      const created = body<AttendanceResponseBody>(createRes);

      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeA.id}/attendance/${created.date.slice(0, 10)}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ checkOutTime: '17:00' })
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeA.id}/attendance`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it.each(READ_ONLY_ROLE_NAMES)(
      '%s : lecture seule (200 en GET, 403 en écriture)',
      async (roleName) => {
        const token = await mintToken(farmA.id, roleName);

        await request(app.getHttpServer())
          .get(`/api/v1/employees/${employeeA.id}/attendance`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/employees/${employeeA.id}/attendance`)
          .set('Authorization', `Bearer ${token}`)
          .send({ date: '2026-04-01', status: 'PRESENT', checkInTime: '08:00' })
          .expect(403);
        expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
      },
    );

    it.each(NO_ACCESS_ROLE_NAMES)('%s : aucun accès au pointage (403)', async (roleName) => {
      const token = await mintToken(farmA.id, roleName);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeA.id}/attendance`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });
  });

  describe('Isolation farmId croisée — testée avec un rôle ayant réellement ATTENDANCE_READ des deux côtés', () => {
    let employeeB: EmployeeResponseBody;
    let ownerBToken: string;

    beforeAll(async () => {
      ownerBToken = await mintToken(farmB.id, 'Propriétaire / Administrateur');
      employeeB = await createEmployee(ownerBToken, farmB.id, { name: 'Employé Ferme B' });
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeB.id}/attendance`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .send({ date: '2026-02-01', status: 'PRESENT', checkInTime: '08:00' })
        .expect(201);
    });

    it('un Propriétaire de la ferme A ne peut pas accéder au pointage d’un employé de la ferme B → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeB.id}/attendance`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('un Propriétaire de la ferme B ne peut pas accéder au pointage d’un employé de la ferme A → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeA.id}/attendance`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });
  });
});
