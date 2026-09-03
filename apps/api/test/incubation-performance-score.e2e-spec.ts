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
} from './helpers/e2e-test-utils';

/**
 * Score de performance — Couvoir (Lot 5, IA). GET
 * /incubation-batches/:id/performance-score, GET/PUT
 * /incubation-batches/performance-coefficients. Couvre : les 2 composantes
 * (éclosion/fécondité) restent `null` (score INSUFFISANT) tant que
 * `chicksHatched` n'est pas renseigné — même restriction "ECLOS
 * uniquement" que la Comparaison Lot 4 — puis contribuent après saisie du
 * bilan de mirage/éclosion. RBAC (lecture INCUBATION_BATCHES_READ,
 * écriture FARMS_UPDATE), isolation farmId.
 *
 * Setup BreederBatch/Incubator créés directement via Prisma (pas rejoué
 * via l'API — déjà couvert de bout en bout par
 * incubation-batches.e2e-spec.ts, hors périmètre de ce fichier qui teste
 * uniquement le score).
 */
jest.setTimeout(30_000);
interface PerformanceScoreComponentBody {
  key: string;
  rawValue: number | null;
  weight: number;
  contributionPercent: number | null;
}
interface PerformanceScoreBody {
  scoreOn100: number | null;
  dataStatus: 'SUFFISANT' | 'INSUFFISANT';
  components: PerformanceScoreComponentBody[];
  calculatedAt: string;
}

const FULL_ACCESS_ROLE = 'Propriétaire / Administrateur';
const DOMAIN_ROLE_WITHOUT_FARMS_UPDATE = 'Responsable couvoir';
const NO_ACCESS_ROLE = 'Vendeur / Caisse';

describe('Score de performance — Couvoir (e2e, Lot 5)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let tokenService: TokenService;

  let farmA: { id: string };
  let farmB: { id: string };
  let roleIdByName: Map<string, string>;
  const permissionsByRoleName = new Map(ROLES_CATALOG.map((r) => [r.name, r.permissions]));

  const createdUserIds: string[] = [];
  const createdIncubationBatchIds: string[] = [];
  const createdBreederBatchIds: string[] = [];
  const createdIncubatorIds: string[] = [];
  let buildingId: string;
  let ownerUserId: string;
  let ownerTokenA: string;
  let ownerTokenB: string;

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
    for (const name of [FULL_ACCESS_ROLE, DOMAIN_ROLE_WITHOUT_FARMS_UPDATE, NO_ACCESS_ROLE]) {
      if (!roleIdByName.has(name)) {
        throw new Error(`Rôle "${name}" introuvable — lancer \`npm run db:seed\` avant les tests.`);
      }
    }

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (incubation-score e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (incubation-score e2e ${Date.now()})` },
    });

    const ownerA = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleIdByName.get(FULL_ACCESS_ROLE)!,
      'UnusedPassword!2026',
    );
    ownerUserId = ownerA.id;
    createdUserIds.push(ownerA.id);
    ownerTokenA = tokenService.signAccessToken({
      sub: ownerA.id,
      farmId: farmA.id,
      roles: [FULL_ACCESS_ROLE],
      permissions: permissionsByRoleName.get(FULL_ACCESS_ROLE)!,
    });

    const ownerB = await createActiveUser(
      prisma,
      passwordService,
      farmB.id,
      roleIdByName.get(FULL_ACCESS_ROLE)!,
      'UnusedPassword!2026',
    );
    createdUserIds.push(ownerB.id);
    ownerTokenB = tokenService.signAccessToken({
      sub: ownerB.id,
      farmId: farmB.id,
      roles: [FULL_ACCESS_ROLE],
      permissions: permissionsByRoleName.get(FULL_ACCESS_ROLE)!,
    });

    const building = await prisma.building.create({
      data: {
        farmId: farmA.id,
        name: 'Bâtiment Reproducteurs Score Test',
        type: 'REPRODUCTEUR',
        createdBy: ownerUserId,
      },
    });
    buildingId = building.id;
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.incubationBatch.deleteMany({
        where: { id: { in: createdIncubationBatchIds } },
      });
      await prisma.breederBatch.deleteMany({ where: { id: { in: createdBreederBatchIds } } });
      await prisma.incubator.deleteMany({ where: { id: { in: createdIncubatorIds } } });
      await prisma.setting.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.building.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  async function createIncubationBatch(
    farmId: string,
    managerId: string,
    bId: string,
    eggCount = 1000,
  ): Promise<string> {
    const breederBatch = await prisma.breederBatch.create({
      data: {
        farmId,
        code: `REP-SCORE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        constitutionDate: new Date(),
        femaleCount: 1800,
        maleCount: 200,
        buildingId: bId,
        primaryManagerId: managerId,
        createdBy: managerId,
      },
    });
    createdBreederBatchIds.push(breederBatch.id);

    const incubator = await prisma.incubator.create({
      data: { farmId, name: `Couveuse Score ${Date.now()}`, createdBy: managerId },
    });
    createdIncubatorIds.push(incubator.id);

    const incubationBatch = await prisma.incubationBatch.create({
      data: {
        farmId,
        code: `INC-SCORE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        breederBatchId: breederBatch.id,
        incubatorId: incubator.id,
        incubationStartDate: new Date(),
        eggCount,
        createdBy: managerId,
      },
    });
    createdIncubationBatchIds.push(incubationBatch.id);
    return incubationBatch.id;
  }

  async function registerHatch(
    token: string,
    incubationBatchId: string,
    payload: {
      eggsInfertile: number;
      eggsInfected: number;
      embryonicMortality: number;
      chicksHatched: number;
    },
  ): Promise<void> {
    await request(app.getHttpServer())
      .patch(`/api/v1/incubation-batches/${incubationBatchId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actualHatchDate: new Date().toISOString(), status: 'ECLOS', ...payload })
      .expect(200);
  }

  async function getScore(token: string, incubationBatchId: string): Promise<PerformanceScoreBody> {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/incubation-batches/${incubationBatchId}/performance-score`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return body<PerformanceScoreBody>(res);
  }

  function componentByKey(score: PerformanceScoreBody, key: string): PerformanceScoreComponentBody {
    const component = score.components.find((c) => c.key === key);
    expect(component).toBeDefined();
    return component!;
  }

  it('lot EN_INCUBATION (pas encore éclos) : les 2 composantes sont null -> score INSUFFISANT (jamais un chiffre inventé avant l’éclosion)', async () => {
    const id = await createIncubationBatch(farmA.id, ownerUserId, buildingId);
    const score = await getScore(ownerTokenA, id);
    expect(componentByKey(score, 'hatchRate').contributionPercent).toBeNull();
    expect(componentByKey(score, 'fertilityRate').contributionPercent).toBeNull();
    expect(score.scoreOn100).toBeNull();
    expect(score.dataStatus).toBe('INSUFFISANT');
  });

  it('après saisie du bilan de mirage/éclosion : les 2 composantes contribuent, poids égaux (1/2) par défaut', async () => {
    const id = await createIncubationBatch(farmA.id, ownerUserId, buildingId, 1000);
    await registerHatch(ownerTokenA, id, {
      eggsInfertile: 130,
      eggsInfected: 20,
      embryonicMortality: 50,
      chicksHatched: 800,
    });

    const score = await getScore(ownerTokenA, id);
    const hatchRate = componentByKey(score, 'hatchRate');
    const fertilityRate = componentByKey(score, 'fertilityRate');
    expect(hatchRate.rawValue).toBeCloseTo(80); // 800/1000
    expect(hatchRate.weight).toBeCloseTo(0.5);
    expect(fertilityRate.rawValue).toBeCloseTo(87, 0); // (1000-130)/1000
    expect(score.dataStatus).toBe('SUFFISANT');
    expect(score.scoreOn100).toBeCloseTo((80 + 87) / 2, 0);
  });

  it('coefficients configurés (PUT) respectés côté score', async () => {
    const id = await createIncubationBatch(farmA.id, ownerUserId, buildingId, 1000);
    await registerHatch(ownerTokenA, id, {
      eggsInfertile: 100,
      eggsInfected: 0,
      embryonicMortality: 0,
      chicksHatched: 900,
    });

    await request(app.getHttpServer())
      .put('/api/v1/incubation-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ hatchRate: { weight: 0.9 }, fertilityRate: { weight: 0.1 } })
      .expect(200);

    const score = await getScore(ownerTokenA, id);
    expect(componentByKey(score, 'hatchRate').weight).toBeCloseTo(0.9);
  });

  it('PUT rejette une clé de composante inconnue (400) et un poids négatif (400)', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/incubation-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ mortality: { weight: 0.5 } }) // pas une composante Couvoir
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/v1/incubation-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ hatchRate: { weight: -1 } })
      .expect(400);
  });

  it(`${DOMAIN_ROLE_WITHOUT_FARMS_UPDATE} : lit le score mais ne peut pas écrire les coefficients (403)`, async () => {
    const { id: userId } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleIdByName.get(DOMAIN_ROLE_WITHOUT_FARMS_UPDATE)!,
      'UnusedPassword!2026',
    );
    createdUserIds.push(userId);
    const token = tokenService.signAccessToken({
      sub: userId,
      farmId: farmA.id,
      roles: [DOMAIN_ROLE_WITHOUT_FARMS_UPDATE],
      permissions: permissionsByRoleName.get(DOMAIN_ROLE_WITHOUT_FARMS_UPDATE)!,
    });
    const id = await createIncubationBatch(farmA.id, ownerUserId, buildingId);

    await request(app.getHttpServer())
      .get(`/api/v1/incubation-batches/${id}/performance-score`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .put('/api/v1/incubation-batches/performance-coefficients')
      .set('Authorization', `Bearer ${token}`)
      .send({ hatchRate: { weight: 0.5 } })
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it(`${NO_ACCESS_ROLE} : aucune permission INCUBATION_BATCHES_READ -> 403 sur le score`, async () => {
    const { id: userId } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleIdByName.get(NO_ACCESS_ROLE)!,
      'UnusedPassword!2026',
    );
    createdUserIds.push(userId);
    const token = tokenService.signAccessToken({
      sub: userId,
      farmId: farmA.id,
      roles: [NO_ACCESS_ROLE],
      permissions: [],
    });
    const id = await createIncubationBatch(farmA.id, ownerUserId, buildingId);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/incubation-batches/${id}/performance-score`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it('isolation farmId : les coefficients de la Ferme A ne s’appliquent jamais à un score de la Ferme B', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/incubation-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ hatchRate: { weight: 0.95 } })
      .expect(200);

    const buildingB = await prisma.building.create({
      data: {
        farmId: farmB.id,
        name: 'Bâtiment Reproducteurs B',
        type: 'REPRODUCTEUR',
        createdBy: ownerUserId,
      },
    });
    const ownerBUser = await prisma.user.findFirstOrThrow({ where: { farmId: farmB.id } });
    const idB = await createIncubationBatch(farmB.id, ownerBUser.id, buildingB.id);
    await registerHatch(ownerTokenB, idB, {
      eggsInfertile: 50,
      eggsInfected: 0,
      embryonicMortality: 0,
      chicksHatched: 900,
    });

    const scoreB = await getScore(ownerTokenB, idB);
    expect(componentByKey(scoreB, 'hatchRate').weight).toBeCloseTo(0.5); // pas 0.95
  });
});
