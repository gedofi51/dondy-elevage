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
 * Modules Payroll + SalaryAdvance (Personnel — Lot 5) : suivi indicatif
 * de la paie, nestés sous Employee. Combinés dans un seul fichier (même
 * précédent que suppliers-customers.e2e-spec.ts) : leur interaction
 * réelle (balayage automatique des avances) ne peut être testée qu'ensemble.
 * Même pattern que attendance/employee-tasks.e2e-spec.ts (mintToken via
 * TokenService, 1 seul vrai flux HTTP — voir leur commentaire d'en-tête).
 */
jest.setTimeout(30_000);

interface EmployeeResponseBody {
  id: string;
  farmId: string;
}

interface PayrollResponseBody {
  id: string;
  farmId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  baseSalaryFcfa: number;
  bonusFcfa: number;
  deductionsFcfa: number;
  netFcfa: number;
  status: string;
}

interface AdvanceResponseBody {
  id: string;
  employeeId: string;
  amountFcfa: number;
  deductedInPayrollId: string | null;
}

const FULL_ACCESS_ROLE_NAMES = [
  'Propriétaire / Administrateur',
  'Gérant / Responsable ferme',
  'Comptable / Responsable financier',
] as const;
const NO_ACCESS_ROLE_NAMES = [
  'Responsable élevage',
  'Responsable couvoir',
  'Responsable eau',
  'Magasinier / Responsable stocks',
  'Vendeur / Caisse',
  'Employé',
  'Lecteur / Lecture seule',
] as const;

describe('Payroll + SalaryAdvance — CRUD, balayage, RBAC, isolation farmId (e2e)', () => {
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
    const requiredRoleNames = [...FULL_ACCESS_ROLE_NAMES, ...NO_ACCESS_ROLE_NAMES];
    for (const name of requiredRoleNames) {
      if (!roleIdByName.has(name)) {
        throw new Error(`Rôle "${name}" introuvable — lancer \`npm run db:seed\` avant les tests.`);
      }
    }

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (payroll e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (payroll e2e ${Date.now()})` },
    });
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.salaryAdvance.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.payroll.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.employee.deleteMany({ where: { id: { in: createdEmployeeIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

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
    baseSalaryFcfa: number,
    overrides: Record<string, unknown> = {},
  ): Promise<EmployeeResponseBody> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Employé Test Paie',
        position: 'Ouvrier',
        hireDate: '2026-01-01',
        baseSalaryFcfa,
        ...overrides,
      })
      .expect(201);
    const employee = body<EmployeeResponseBody>(res);
    createdEmployeeIds.push(employee.id);
    return employee;
  }

  let ownerAToken: string;
  let employeeA: EmployeeResponseBody;

  it('un Propriétaire peut se connecter via /auth/connexion (vrai flux HTTP) et son token porte PAYROLL_CREATE', async () => {
    const password = 'OwnerPayrollTest!2026';
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

    employeeA = await createEmployee(ownerAToken, farmA.id, 100_000);

    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/payroll`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ periodStart: '2026-01-01', periodEnd: '2026-01-31' })
      .expect(201)
      .then((r) => expect(body<PayrollResponseBody>(r).netFcfa).toBe(100_000));
  });

  describe('Balayage automatique des avances non déduites', () => {
    let advance1Id: string;
    let advance2Id: string;
    let payroll1Id: string;

    it('une avance créée avant le relevé suivant est balayée dedans (deductedInPayrollId renseigné, netFcfa déduit)', async () => {
      const advanceRes = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeA.id}/advances`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ date: '2026-02-05', amountFcfa: 20_000 })
        .expect(201);
      advance1Id = body<AdvanceResponseBody>(advanceRes).id;
      expect(body<AdvanceResponseBody>(advanceRes).deductedInPayrollId).toBeNull();

      const payrollRes = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeA.id}/payroll`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ periodStart: '2026-02-01', periodEnd: '2026-02-28', bonusFcfa: 5_000 })
        .expect(201);
      const payroll1 = body<PayrollResponseBody>(payrollRes);
      payroll1Id = payroll1.id;
      // 100 000 base + 5 000 prime - 0 retenue - 20 000 avance = 85 000.
      expect(payroll1.netFcfa).toBe(85_000);

      const advanceAfter = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeA.id}/advances/${advance1Id}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(200);
      expect(body<AdvanceResponseBody>(advanceAfter).deductedInPayrollId).toBe(payroll1Id);
    });

    it("une avance créée APRÈS le relevé n'est pas rattrapée rétroactivement — reste en attente pour le relevé suivant", async () => {
      const advanceRes = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeA.id}/advances`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ date: '2026-02-20', amountFcfa: 8_000 })
        .expect(201);
      advance2Id = body<AdvanceResponseBody>(advanceRes).id;
      expect(body<AdvanceResponseBody>(advanceRes).deductedInPayrollId).toBeNull();

      const payroll1Reloaded = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeA.id}/payroll/${payroll1Id}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(200);
      // netFcfa du relevé déjà créé reste inchangé.
      expect(body<PayrollResponseBody>(payroll1Reloaded).netFcfa).toBe(85_000);

      const payroll2Res = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeA.id}/payroll`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ periodStart: '2026-03-01', periodEnd: '2026-03-31' })
        .expect(201);
      // 100 000 base - 8 000 avance restante = 92 000.
      expect(body<PayrollResponseBody>(payroll2Res).netFcfa).toBe(92_000);

      const advance2After = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeA.id}/advances/${advance2Id}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(200);
      expect(body<AdvanceResponseBody>(advance2After).deductedInPayrollId).toBe(
        body<PayrollResponseBody>(payroll2Res).id,
      );
    });

    it('une avance déjà déduite devient immuable (409), une avance non déduite reste corrigeable', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeA.id}/advances/${advance1Id}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ amountFcfa: 25_000 })
        .expect(409);

      const freshAdvance = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeA.id}/advances`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ date: '2026-04-01', amountFcfa: 3_000 })
        .expect(201);
      const freshId = body<AdvanceResponseBody>(freshAdvance).id;
      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeA.id}/advances/${freshId}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ amountFcfa: 4_000 })
        .expect(200);
    });
  });

  describe('Validation d’un relevé — statut terminal', () => {
    let toValidateId: string;

    it('valide un relevé en BROUILLON (PATCH status: VALIDE)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeA.id}/payroll`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ periodStart: '2026-05-01', periodEnd: '2026-05-31' })
        .expect(201);
      toValidateId = body<PayrollResponseBody>(res).id;

      const validated = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeA.id}/payroll/${toValidateId}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ status: 'VALIDE' })
        .expect(200);
      expect(body<PayrollResponseBody>(validated).status).toBe('VALIDE');
    });

    it('refuse toute modification une fois VALIDE (409) — jamais supprimé, jamais réécrit', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeA.id}/payroll/${toValidateId}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ bonusFcfa: 1_000 })
        .expect(409);
    });
  });

  describe('Validations de montants', () => {
    it('refuse un relevé produisant un net à payer négatif (400)', async () => {
      const lowPaidEmployee = await createEmployee(ownerAToken, farmA.id, 10_000, {
        name: 'Employé Bas Salaire',
      });
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${lowPaidEmployee.id}/payroll`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ periodStart: '2026-01-01', periodEnd: '2026-01-31', deductionsFcfa: 50_000 })
        .expect(400);
    });

    it('refuse periodEnd antérieur à periodStart (400)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeA.id}/payroll`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ periodStart: '2026-06-30', periodEnd: '2026-06-01' })
        .expect(400);
    });

    it('refuse un second relevé pour le même employé sur la même periodStart (409)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeA.id}/payroll`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ periodStart: '2026-05-01', periodEnd: '2026-05-31' })
        .expect(409);
    });
  });

  describe('RBAC — chaque rôle de la matrice testé', () => {
    it.each(FULL_ACCESS_ROLE_NAMES)(
      '%s : accès complet (Payroll + SalaryAdvance)',
      async (roleName) => {
        const token = await mintToken(farmA.id, roleName);
        // periodStart distinct par itération — @@unique([employeeId,
        // periodStart]) collisionnerait sinon entre les 3 rôles testés
        // sur le même employeeA.
        const monthIndex = FULL_ACCESS_ROLE_NAMES.indexOf(roleName) + 7;
        const periodStart = `2026-${String(monthIndex).padStart(2, '0')}-01`;
        const periodEnd = `2026-${String(monthIndex).padStart(2, '0')}-28`;

        const advanceRes = await request(app.getHttpServer())
          .post(`/api/v1/employees/${employeeA.id}/advances`)
          .set('Authorization', `Bearer ${token}`)
          .send({ date: periodStart, amountFcfa: 1_000 })
          .expect(201);
        const advanceId = body<AdvanceResponseBody>(advanceRes).id;

        await request(app.getHttpServer())
          .patch(`/api/v1/employees/${employeeA.id}/advances/${advanceId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ amountFcfa: 1_500 })
          .expect(200);

        const payrollRes = await request(app.getHttpServer())
          .post(`/api/v1/employees/${employeeA.id}/payroll`)
          .set('Authorization', `Bearer ${token}`)
          .send({ periodStart, periodEnd })
          .expect(201);
        const payrollId = body<PayrollResponseBody>(payrollRes).id;

        await request(app.getHttpServer())
          .get(`/api/v1/employees/${employeeA.id}/payroll`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        await request(app.getHttpServer())
          .patch(`/api/v1/employees/${employeeA.id}/payroll/${payrollId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'VALIDE' })
          .expect(200);
      },
    );

    it.each(NO_ACCESS_ROLE_NAMES)(
      '%s : aucun accès à Payroll/SalaryAdvance (403)',
      async (roleName) => {
        const token = await mintToken(farmA.id, roleName);

        const payrollRes = await request(app.getHttpServer())
          .get(`/api/v1/employees/${employeeA.id}/payroll`)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
        expect(body<ErrorResponseBody>(payrollRes).message).toContain('Permissions insuffisantes');

        const advanceRes = await request(app.getHttpServer())
          .get(`/api/v1/employees/${employeeA.id}/advances`)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
        expect(body<ErrorResponseBody>(advanceRes).message).toContain('Permissions insuffisantes');
      },
    );
  });

  describe('Isolation farmId croisée — testée avec un rôle ayant réellement PAYROLL_READ/SALARY_ADVANCES_READ des deux côtés', () => {
    let employeeB: EmployeeResponseBody;
    let ownerBToken: string;

    beforeAll(async () => {
      ownerBToken = await mintToken(farmB.id, 'Propriétaire / Administrateur');
      employeeB = await createEmployee(ownerBToken, farmB.id, 60_000, { name: 'Employé Ferme B' });
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeB.id}/payroll`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .send({ periodStart: '2026-01-01', periodEnd: '2026-01-31' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeB.id}/advances`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .send({ date: '2026-01-05', amountFcfa: 1_000 })
        .expect(201);
    });

    it('un Propriétaire de la ferme A ne peut pas accéder à la paie/aux avances d’un employé de la ferme B → 404 générique', async () => {
      const payrollRes = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeB.id}/payroll`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(payrollRes).message).toBe('Ressource introuvable.');

      const advanceRes = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeB.id}/advances`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(advanceRes).message).toBe('Ressource introuvable.');
    });

    it('un Propriétaire de la ferme B ne peut pas accéder à la paie/aux avances d’un employé de la ferme A → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeA.id}/payroll`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });
  });
});
