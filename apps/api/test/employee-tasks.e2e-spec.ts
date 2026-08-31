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
 * Module EmployeeTasks (Personnel — Lot 4) : tâches assignées, nesté sous
 * Employee (/employees/:employeeId/tasks), RBAC, isolation farmId. Aucun
 * moteur de tâches transverse trouvé dans le dépôt (voir
 * DETTE_TECHNIQUE.md) — module autonome, même patron que
 * attendance.e2e-spec.ts (mintToken via TokenService, 1 seul vrai flux
 * HTTP, voir son commentaire d'en-tête pour le détail du throttle).
 */
jest.setTimeout(30_000);

interface EmployeeResponseBody {
  id: string;
  farmId: string;
  status: string;
}

interface TaskResponseBody {
  id: string;
  farmId: string;
  employeeId: string;
  designation: string;
  dueDate: string;
  status: string;
  cancelReason: string | null;
  isLate: boolean;
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

describe('EmployeeTasks — CRUD, RBAC et isolation farmId (e2e)', () => {
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
      data: { name: `Ferme Test A (employee-tasks e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (employee-tasks e2e ${Date.now()})` },
    });
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.employeeTask.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
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
    overrides: Record<string, unknown> = {},
  ): Promise<EmployeeResponseBody> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Employé Test Tâches',
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
  let taskAId: string;

  it('un Propriétaire peut se connecter via /auth/connexion (vrai flux HTTP) et son token porte EMPLOYEE_TASKS_CREATE', async () => {
    const password = 'OwnerTaskTest!2026';
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

    const taskRes = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/tasks`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ designation: 'Nettoyer le poulailler A', dueDate: '2026-03-01' })
      .expect(201);
    const task = body<TaskResponseBody>(taskRes);
    expect(task.status).toBe('A_FAIRE');
    taskAId = task.id;
  });

  it('fait progresser la tâche (EN_COURS puis REALISEE)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeA.id}/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ status: 'EN_COURS' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeA.id}/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ status: 'REALISEE' })
      .expect(200);
    expect(body<TaskResponseBody>(res).status).toBe('REALISEE');
  });

  it('refuse toute modification d’une tâche déjà clôturée (409)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeA.id}/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ designation: 'Modification refusée' })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/tasks/${taskAId}/annuler`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({})
      .expect(409);
  });

  it('annule une tâche encore ouverte avec un motif, tracé', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/tasks`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ designation: 'Tâche à annuler', dueDate: '2026-03-05' })
      .expect(201);
    const taskId = body<TaskResponseBody>(createRes).id;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/tasks/${taskId}/annuler`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ cancelReason: 'Doublon' })
      .expect(201);
    const cancelled = body<TaskResponseBody>(res);
    expect(cancelled.status).toBe('ANNULEE');
    expect(cancelled.cancelReason).toBe('Doublon');

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: 'employee_task', entityId: taskId, action: 'EMPLOYEE_TASK_CANCELLED' },
    });
    expect(auditRows).toHaveLength(1);
  });

  it('isLate : vrai pour une tâche ouverte en retard, faux une fois clôturée', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/tasks`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ designation: 'Tâche en retard', dueDate: '2020-01-01' })
      .expect(201);
    const late = body<TaskResponseBody>(createRes);
    expect(late.isLate).toBe(true);

    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeA.id}/tasks/${late.id}/annuler`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({})
      .expect(201);
    expect(body<TaskResponseBody>(cancelRes).isLate).toBe(false);
  });

  describe('Tâche impossible sur un employé inactif', () => {
    let suspendedEmployee: EmployeeResponseBody;

    beforeAll(async () => {
      suspendedEmployee = await createEmployee(ownerAToken, farmA.id, {
        name: 'Employé Suspendu Test Tâches',
      });
      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${suspendedEmployee.id}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ status: 'SUSPENDU' })
        .expect(200);
    });

    it('refuse une nouvelle tâche (409)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/employees/${suspendedEmployee.id}/tasks`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ designation: 'Tâche refusée', dueDate: '2026-04-01' })
        .expect(409);
      expect(body<ErrorResponseBody>(res).message).toContain('suspendu');
    });
  });

  describe('RBAC — chaque rôle de la matrice testé', () => {
    it.each(FULL_ACCESS_ROLE_NAMES)(
      '%s : accès complet (create/read/update/annuler)',
      async (roleName) => {
        const token = await mintToken(farmA.id, roleName);
        const createRes = await request(app.getHttpServer())
          .post(`/api/v1/employees/${employeeA.id}/tasks`)
          .set('Authorization', `Bearer ${token}`)
          .send({ designation: `Tâche ${roleName}`, dueDate: '2026-05-01' })
          .expect(201);
        const created = body<TaskResponseBody>(createRes);

        await request(app.getHttpServer())
          .patch(`/api/v1/employees/${employeeA.id}/tasks/${created.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'EN_COURS' })
          .expect(200);

        await request(app.getHttpServer())
          .get(`/api/v1/employees/${employeeA.id}/tasks`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        await request(app.getHttpServer())
          .post(`/api/v1/employees/${employeeA.id}/tasks/${created.id}/annuler`)
          .set('Authorization', `Bearer ${token}`)
          .send({})
          .expect(201);
      },
    );

    it.each(READ_ONLY_ROLE_NAMES)(
      '%s : lecture seule (200 en GET, 403 en écriture)',
      async (roleName) => {
        const token = await mintToken(farmA.id, roleName);

        await request(app.getHttpServer())
          .get(`/api/v1/employees/${employeeA.id}/tasks`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/employees/${employeeA.id}/tasks`)
          .set('Authorization', `Bearer ${token}`)
          .send({ designation: 'Refusé', dueDate: '2026-06-01' })
          .expect(403);
        expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
      },
    );

    it.each(NO_ACCESS_ROLE_NAMES)('%s : aucun accès aux tâches (403)', async (roleName) => {
      const token = await mintToken(farmA.id, roleName);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeA.id}/tasks`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });
  });

  describe('Isolation farmId croisée — testée avec un rôle ayant réellement EMPLOYEE_TASKS_READ des deux côtés', () => {
    let employeeB: EmployeeResponseBody;
    let ownerBToken: string;

    beforeAll(async () => {
      ownerBToken = await mintToken(farmB.id, 'Propriétaire / Administrateur');
      employeeB = await createEmployee(ownerBToken, farmB.id, { name: 'Employé Ferme B' });
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeB.id}/tasks`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .send({ designation: 'Tâche ferme B', dueDate: '2026-03-01' })
        .expect(201);
    });

    it('un Propriétaire de la ferme A ne peut pas accéder aux tâches d’un employé de la ferme B → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeB.id}/tasks`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('un Propriétaire de la ferme B ne peut pas accéder aux tâches d’un employé de la ferme A → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeA.id}/tasks`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });
  });
});
