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
 * Module Employees (Personnel — Lot 2) : CRUD sur la fiche employé, RBAC
 * appliqué côté serveur, isolation farmId — même pattern que
 * suppliers-customers.e2e-spec.ts (vraie base MySQL, pas de mocks).
 *
 * POST /auth/connexion est throttlé à 10 requêtes/15 min par IP
 * (auth.controller.ts — protection brute force, non négociable). "Chaque
 * rôle testé" (11 rôles au total dans ce fichier, RBAC §8 de
 * docs/reference/MODULE_PERSONNEL.md) dépasse largement ce budget si
 * chaque utilisateur de test se connecte réellement en HTTP —
 * un seul test dédié (voir plus bas) exerce le vrai flux HTTP pour
 * prouver l'intégration bout en bout ; tous les autres tokens sont signés
 * directement via TokenService (même utilisateur réel créé en base,
 * mêmes permissions issues de ROLES_CATALOG — seul le transport HTTP du
 * login est court-circuité, ce que PermissionsGuard/assertSameFarm ne
 * distinguent de toute façon pas).
 */
jest.setTimeout(30_000);

interface EmployeeResponseBody {
  id: string;
  farmId: string;
  code: string;
  name: string;
  position: string;
  status: string;
  baseSalaryFcfa: number;
  hireDate: string;
  endDate: string | null;
  deletedAt: string | null;
}

// Rôles sans aucune permission EMPLOYEES_* — voir docs/reference/
// MODULE_PERSONNEL.md §8 (Lecteur/Lecture seule et Comptable sont testés
// séparément ci-dessous, tous deux avec un accès partiel).
const NO_ACCESS_ROLE_NAMES = [
  'Responsable élevage',
  'Responsable couvoir',
  'Responsable eau',
  'Magasinier / Responsable stocks',
  'Vendeur / Caisse',
  'Employé',
] as const;

describe('Employees — CRUD, RBAC et isolation farmId (e2e)', () => {
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
      'Propriétaire / Administrateur',
      'Gérant / Responsable ferme',
      'Comptable / Responsable financier',
      'Lecteur / Lecture seule',
      ...NO_ACCESS_ROLE_NAMES,
    ];
    for (const name of requiredRoleNames) {
      if (!roleIdByName.has(name)) {
        throw new Error(`Rôle "${name}" introuvable — lancer \`npm run db:seed\` avant les tests.`);
      }
    }

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (employees e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (employees e2e ${Date.now()})` },
    });
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.employee.deleteMany({ where: { id: { in: createdEmployeeIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  /** Utilisateur réel créé en base + token signé directement via
   * TokenService (pas de HTTP, pas de throttle) — voir le commentaire
   * d'en-tête du fichier sur le budget de 10 connexions/15min. */
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

  let ownerAToken: string;
  let employeeAId: string;

  it('un Propriétaire peut se connecter via /auth/connexion (vrai flux HTTP) et obtient un token permissionné', async () => {
    const password = 'OwnerEmpTest!2026';
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

    // Le token obtenu par le vrai flux HTTP doit porter EMPLOYEES_CREATE
    // (confirmé indirectement : la création qui suit doit réussir).
    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Sonde HTTP', position: 'Test', hireDate: '2026-01-01', baseSalaryFcfa: 1 })
      .expect(201)
      .then((r) => createdEmployeeIds.push(body<EmployeeResponseBody>(r).id));
  });

  it('crée un employé avec un code auto-généré (EMP-AAAA-NNN)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        name: 'Jean Koyamba',
        position: 'Ouvrier agricole',
        hireDate: '2026-01-15',
        baseSalaryFcfa: 80_000,
      })
      .expect(201);
    const employee = body<EmployeeResponseBody>(res);
    expect(employee.farmId).toBe(farmA.id);
    expect(employee.code).toMatch(/^EMP-2026-\d{3}$/);
    expect(employee.status).toBe('ACTIF');
    employeeAId = employee.id;
    createdEmployeeIds.push(employeeAId);
  });

  it('refuse une date de sortie antérieure à la date d’embauche (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        name: 'Test Dates Invalides',
        position: 'Test',
        hireDate: '2026-06-01',
        endDate: '2026-01-01',
        baseSalaryFcfa: 50_000,
      })
      .expect(400);
  });

  it('refuse un salaire de base négatif (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        name: 'Test Salaire Négatif',
        position: 'Test',
        hireDate: '2026-01-01',
        baseSalaryFcfa: -1,
      })
      .expect(400);
  });

  it('modifie la fiche (poste, salaire)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeAId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ position: 'Chef d’équipe', baseSalaryFcfa: 95_000 })
      .expect(200);
    const employee = body<EmployeeResponseBody>(res);
    expect(employee.position).toBe('Chef d’équipe');
    expect(employee.baseSalaryFcfa).toBe(95_000);
  });

  describe('Fiche suspendue/sortie — modifiable uniquement pour réactivation explicite', () => {
    it('suspend l’employé', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeAId}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ status: 'SUSPENDU' })
        .expect(200);
    });

    it('refuse un PATCH qui ne réactive pas explicitement (409)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeAId}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ position: 'Nouveau poste pendant la suspension' })
        .expect(409);
      expect(body<ErrorResponseBody>(res).message).toContain('réactivation');
    });

    it('autorise la réactivation explicite (status: ACTIF)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeAId}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ status: 'ACTIF' })
        .expect(200);
      expect(body<EmployeeResponseBody>(res).status).toBe('ACTIF');
    });
  });

  it('supprime (soft delete) — la ligne reste en base avec deletedAt, GET renvoie 404 ensuite', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/employees/${employeeAId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(204);

    const row = await prisma.employee.findUnique({ where: { id: employeeAId } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();

    await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeAId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(404);

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: 'employee', entityId: employeeAId, action: 'EMPLOYEE_DELETED' },
    });
    expect(auditRows).toHaveLength(1);
  });

  describe('RBAC — chaque rôle testé', () => {
    let ganantAToken: string;
    let secondEmployeeId: string;

    beforeAll(async () => {
      ganantAToken = await mintToken(farmA.id, 'Gérant / Responsable ferme');
      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${ganantAToken}`)
        .send({
          name: 'Marie Ngassa',
          position: 'Gardienne',
          hireDate: '2026-02-01',
          baseSalaryFcfa: 60_000,
        })
        .expect(201);
      secondEmployeeId = body<EmployeeResponseBody>(res).id;
      createdEmployeeIds.push(secondEmployeeId);
    });

    it('Gérant / Responsable ferme a le même accès complet que Propriétaire', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${secondEmployeeId}`)
        .set('Authorization', `Bearer ${ganantAToken}`)
        .send({ phone: '+236 70 22 22 22' })
        .expect(200);
    });

    it('Comptable / Responsable financier : lecture seule (200 en GET, 403 en écriture)', async () => {
      const comptableToken = await mintToken(farmA.id, 'Comptable / Responsable financier');

      await request(app.getHttpServer())
        .get(`/api/v1/employees/${secondEmployeeId}`)
        .set('Authorization', `Bearer ${comptableToken}`)
        .expect(200);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${comptableToken}`)
        .send({ name: 'Refusé', position: 'Test', hireDate: '2026-01-01', baseSalaryFcfa: 1 })
        .expect(403);
      expect(body<ErrorResponseBody>(createRes).message).toContain('Permissions insuffisantes');

      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${secondEmployeeId}`)
        .set('Authorization', `Bearer ${comptableToken}`)
        .send({ phone: '+236 70 33 33 33' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/employees/${secondEmployeeId}`)
        .set('Authorization', `Bearer ${comptableToken}`)
        .expect(403);
    });

    it('Lecteur / Lecture seule : lecture seule (200 en GET, 403 en écriture) — MODULE_PERSONNEL.md §8', async () => {
      const readerToken = await mintToken(farmA.id, 'Lecteur / Lecture seule');

      await request(app.getHttpServer())
        .get(`/api/v1/employees/${secondEmployeeId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ name: 'Refusé', position: 'Test', hireDate: '2026-01-01', baseSalaryFcfa: 1 })
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });

    it.each(NO_ACCESS_ROLE_NAMES)(
      '%s : aucun accès au module Personnel (403)',
      async (roleName) => {
        const token = await mintToken(farmA.id, roleName);
        const res = await request(app.getHttpServer())
          .get('/api/v1/employees')
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
        expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
      },
    );
  });

  describe('GET /employees/roster (Lot 7-correctif) — registre minimal pour /pointage', () => {
    interface RosterEntry {
      id: string;
      code: string;
      name: string;
      status: string;
    }

    let rosterEmployeeAId: string;
    let rosterEmployeeBId: string;
    let rosterOwnerBToken: string;

    beforeAll(async () => {
      const resA = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({
          name: 'Employé Roster A',
          position: 'Test roster',
          hireDate: '2026-04-01',
          baseSalaryFcfa: 55_000,
          phone: '+236 70 44 44 44',
          contractType: 'CDI',
        })
        .expect(201);
      rosterEmployeeAId = body<EmployeeResponseBody>(resA).id;
      createdEmployeeIds.push(rosterEmployeeAId);

      rosterOwnerBToken = await mintToken(farmB.id, 'Propriétaire / Administrateur');
      const resB = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${rosterOwnerBToken}`)
        .send({
          name: 'Employé Roster B',
          position: 'Test roster',
          hireDate: '2026-04-01',
          baseSalaryFcfa: 55_000,
        })
        .expect(201);
      rosterEmployeeBId = body<EmployeeResponseBody>(resB).id;
      createdEmployeeIds.push(rosterEmployeeBId);
    });

    it('Responsable élevage (ATTENDANCE_READ/EMPLOYEE_TASKS_READ, pas EMPLOYEES_READ) obtient 200 avec des champs strictement minimaux', async () => {
      const token = await mintToken(farmA.id, 'Responsable élevage');
      const res = await request(app.getHttpServer())
        .get('/api/v1/employees/roster')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const roster = body<RosterEntry[]>(res);
      const entry = roster.find((e) => e.id === rosterEmployeeAId);
      expect(entry).toBeDefined();
      expect(entry?.name).toBe('Employé Roster A');
      expect(entry?.status).toBe('ACTIF');
      expect(entry?.code).toMatch(/^EMP-2026-\d{3}$/);
      // Exactement ces 4 clés — jamais salaire/téléphone/contrat, même
      // whitelistés côté select Prisma (employees.service.ts) : vérifié
      // explicitement sur la réponse JSON, pas seulement dans le type TS.
      expect(Object.keys(entry as object).sort()).toEqual(['code', 'id', 'name', 'status']);
    });

    it('un rôle sans aucune des 3 permissions (Responsable couvoir) reçoit 403', async () => {
      const token = await mintToken(farmA.id, 'Responsable couvoir');
      const res = await request(app.getHttpServer())
        .get('/api/v1/employees/roster')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });

    it('isolation farmId : le registre de la ferme A ne contient jamais un employé de la ferme B', async () => {
      const token = await mintToken(farmA.id, 'Responsable élevage');
      const res = await request(app.getHttpServer())
        .get('/api/v1/employees/roster')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const ids = body<RosterEntry[]>(res).map((e) => e.id);
      expect(ids).not.toContain(rosterEmployeeBId);
    });
  });

  describe('Isolation farmId croisée — testée avec des rôles ayant EMPLOYEES_READ des deux côtés, pas juste RBAC', () => {
    let employeeBId: string;
    let employeeAAliveId: string;
    let ownerBToken: string;

    beforeAll(async () => {
      ownerBToken = await mintToken(farmB.id, 'Propriétaire / Administrateur');
      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${ownerBToken}`)
        .send({
          name: 'Employé Ferme B',
          position: 'Test isolation',
          hireDate: '2026-03-01',
          baseSalaryFcfa: 70_000,
        })
        .expect(201);
      employeeBId = body<EmployeeResponseBody>(res).id;
      createdEmployeeIds.push(employeeBId);

      // employeeAId a déjà été soft-supprimé plus haut (404 pour n'importe
      // qui, pas une preuve d'isolation) — il faut une fiche A bien vivante
      // pour tester la direction B → A.
      const resA = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({
          name: 'Employé Ferme A (vivant)',
          position: 'Test isolation',
          hireDate: '2026-03-01',
          baseSalaryFcfa: 65_000,
        })
        .expect(201);
      employeeAAliveId = body<EmployeeResponseBody>(resA).id;
      createdEmployeeIds.push(employeeAAliveId);
    });

    it('un Propriétaire de la ferme B (a EMPLOYEES_READ) ne peut pas lire un employé de la ferme A → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeAAliveId}`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .expect(404);
      // "Ressource introuvable." (assertSameFarm), pas "Employé
      // introuvable." : la ligne existe bel et bien, le message générique
      // évite volontairement de distinguer "n'existe pas" de "appartient
      // à une autre ferme" — même patron que Customers/Suppliers.
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('un Propriétaire de la ferme A ne peut pas lire un employé de la ferme B → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeBId}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('GET /employees (liste) avec le token Propriétaire de la ferme A ne renvoie jamais les employés de la ferme B', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(200);
      const ids = body<EmployeeResponseBody[]>(res).map((e) => e.id);
      expect(ids).not.toContain(employeeBId);
    });
  });

  describe('Masquage champ par champ de baseSalaryFcfa (Lot 5) — MODULE_PERSONNEL.md §8', () => {
    let maskingEmployeeId: string;

    beforeAll(async () => {
      const employee = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({
          name: 'Employé Test Masquage',
          position: 'Test',
          hireDate: '2026-01-01',
          baseSalaryFcfa: 42_000,
        })
        .expect(201);
      maskingEmployeeId = body<EmployeeResponseBody>(employee).id;
      createdEmployeeIds.push(maskingEmployeeId);
    });

    it('un Propriétaire (EMPLOYEES_VIEW_SALARY) voit baseSalaryFcfa dans le JSON de réponse', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${maskingEmployeeId}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(200);
      expect('baseSalaryFcfa' in body<Record<string, unknown>>(res)).toBe(true);
    });

    it('un Lecteur (EMPLOYEES_READ sans EMPLOYEES_VIEW_SALARY) ne voit JAMAIS baseSalaryFcfa dans le JSON — clé absente, pas juste null', async () => {
      const readerToken = await mintToken(farmA.id, 'Lecteur / Lecture seule');

      const oneRes = await request(app.getHttpServer())
        .get(`/api/v1/employees/${maskingEmployeeId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(200);
      const oneBody = body<Record<string, unknown>>(oneRes);
      expect('baseSalaryFcfa' in oneBody).toBe(false);
      expect(JSON.stringify(oneBody)).not.toContain('baseSalaryFcfa');
      // Les autres champs restent bien présents — seul le salaire est masqué.
      expect(oneBody.id).toBe(maskingEmployeeId);
      expect(oneBody.name).toBeDefined();

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(200);
      const listBody = body<Record<string, unknown>[]>(listRes);
      expect(listBody.length).toBeGreaterThan(0);
      for (const item of listBody) {
        expect('baseSalaryFcfa' in item).toBe(false);
      }
    });

    it('un Comptable (EMPLOYEES_VIEW_SALARY, Lot 5) voit baseSalaryFcfa dans le JSON de réponse', async () => {
      const accountantToken = await mintToken(farmA.id, 'Comptable / Responsable financier');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${maskingEmployeeId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);
      expect('baseSalaryFcfa' in body<Record<string, unknown>>(res)).toBe(true);
    });
  });
});
