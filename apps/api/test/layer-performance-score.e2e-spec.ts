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
 * Score de performance — Pondeuses (Lot 5, IA). GET
 * /layer-batches/:id/performance-score, GET/PUT
 * /layer-batches/performance-coefficients. Couvre : mortalité toujours
 * calculable (0 décès = donnée réelle), taux de ponte exclu tant qu'aucune
 * journée n'est saisie (jamais un 0 % inventé pour un lot en ELEVAGE),
 * RBAC (lecture LAYER_BATCHES_READ, écriture FARMS_UPDATE), isolation
 * farmId. Voir broiler-performance-score.e2e-spec.ts pour le même
 * principe côté Chair.
 */
jest.setTimeout(30_000);

interface LayerBatchResponseBody {
  id: string;
}
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
const DOMAIN_ROLE_WITHOUT_FARMS_UPDATE = 'Responsable élevage';
const NO_ACCESS_ROLE = 'Vendeur / Caisse';

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

describe('Score de performance — Pondeuses (e2e, Lot 5)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let tokenService: TokenService;

  let farmA: { id: string };
  let farmB: { id: string };
  let roleIdByName: Map<string, string>;
  const permissionsByRoleName = new Map(ROLES_CATALOG.map((r) => [r.name, r.permissions]));

  const createdUserIds: string[] = [];
  const createdBatchIds: string[] = [];
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
      data: { name: `Ferme Test A (layer-score e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (layer-score e2e ${Date.now()})` },
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
        name: 'Poulailler Ponte Score Test',
        type: 'PONTE',
        createdBy: ownerUserId,
      },
    });
    buildingId = building.id;
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.eggStockLot.deleteMany({ where: { batchId: { in: createdBatchIds } } });
      await prisma.layerDailyRecord.deleteMany({ where: { batchId: { in: createdBatchIds } } });
      await prisma.layerBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
      await prisma.setting.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.building.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  async function createBatch(token: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/layer-batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entryDate: isoDaysAgo(60),
        initialQuantity: 1000,
        buildingId,
        primaryManagerId: ownerUserId,
      })
      .expect(201);
    const id = body<LayerBatchResponseBody>(res).id;
    createdBatchIds.push(id);
    return id;
  }

  async function createDailyRecord(
    token: string,
    batchId: string,
    date: string,
    overrides: Record<string, unknown> = {},
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/v1/layer-batches/${batchId}/daily-records`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date, henCount: 1000, eggsLaid: 850, mortalityQuantity: 0, ...overrides })
      .expect(201);
  }

  async function getScore(token: string, batchId: string): Promise<PerformanceScoreBody> {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/layer-batches/${batchId}/performance-score`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return body<PerformanceScoreBody>(res);
  }

  function componentByKey(score: PerformanceScoreBody, key: string): PerformanceScoreComponentBody {
    const component = score.components.find((c) => c.key === key);
    expect(component).toBeDefined();
    return component!;
  }

  it('lot fraîchement créé (aucune journée saisie) : taux de ponte exclu, mortalité à 0 % (donnée réelle, pas inventée) -> score = 100', async () => {
    const batchId = await createBatch(ownerTokenA);
    const score = await getScore(ownerTokenA, batchId);
    const layingRate = componentByKey(score, 'layingRate');
    expect(layingRate.rawValue).toBeNull();
    expect(layingRate.contributionPercent).toBeNull();
    expect(componentByKey(score, 'mortality').rawValue).toBe(0);
    expect(score.scoreOn100).toBeCloseTo(100);
    expect(score.dataStatus).toBe('SUFFISANT');
  });

  it('journées de ponte saisies : taux de ponte contribue (85 %), poids égaux par défaut (1/2)', async () => {
    const batchId = await createBatch(ownerTokenA);
    for (let i = 1; i <= 3; i++) {
      await createDailyRecord(ownerTokenA, batchId, isoDaysAgo(i), { eggsLaid: 850 });
    }

    const score = await getScore(ownerTokenA, batchId);
    const layingRate = componentByKey(score, 'layingRate');
    expect(layingRate.rawValue).toBeCloseTo(85);
    expect(layingRate.weight).toBeCloseTo(0.5);
    expect(componentByKey(score, 'mortality').weight).toBeCloseTo(0.5);
  });

  it('coefficients configurés (PUT) respectés côté score', async () => {
    const batchId = await createBatch(ownerTokenA);
    await createDailyRecord(ownerTokenA, batchId, isoDaysAgo(1), { eggsLaid: 900 });

    await request(app.getHttpServer())
      .put('/api/v1/layer-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ mortality: { weight: 0.8 }, layingRate: { weight: 0.2 } })
      .expect(200);

    const score = await getScore(ownerTokenA, batchId);
    expect(componentByKey(score, 'mortality').weight).toBeCloseTo(0.8);
    expect(componentByKey(score, 'layingRate').weight).toBeCloseTo(0.2);
  });

  it('PUT rejette une clé de composante inconnue (400, forbidNonWhitelisted) et un poids négatif (400)', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/layer-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ ic: { weight: 0.5 } }) // composante Chair, pas Pondeuses
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/v1/layer-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ mortality: { weight: -0.1 } })
      .expect(400);
  });

  it(`${DOMAIN_ROLE_WITHOUT_FARMS_UPDATE} : lit le score mais ne peut pas écrire les coefficients (403)`, async () => {
    const { id } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleIdByName.get(DOMAIN_ROLE_WITHOUT_FARMS_UPDATE)!,
      'UnusedPassword!2026',
    );
    createdUserIds.push(id);
    const token = tokenService.signAccessToken({
      sub: id,
      farmId: farmA.id,
      roles: [DOMAIN_ROLE_WITHOUT_FARMS_UPDATE],
      permissions: permissionsByRoleName.get(DOMAIN_ROLE_WITHOUT_FARMS_UPDATE)!,
    });
    const batchId = await createBatch(ownerTokenA);

    await request(app.getHttpServer())
      .get(`/api/v1/layer-batches/${batchId}/performance-score`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .put('/api/v1/layer-batches/performance-coefficients')
      .set('Authorization', `Bearer ${token}`)
      .send({ mortality: { weight: 0.5 } })
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it(`${NO_ACCESS_ROLE} : aucune permission LAYER_BATCHES_READ -> 403 sur le score`, async () => {
    const { id } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleIdByName.get(NO_ACCESS_ROLE)!,
      'UnusedPassword!2026',
    );
    createdUserIds.push(id);
    const token = tokenService.signAccessToken({
      sub: id,
      farmId: farmA.id,
      roles: [NO_ACCESS_ROLE],
      permissions: [],
    });
    const batchId = await createBatch(ownerTokenA);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/layer-batches/${batchId}/performance-score`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it('isolation farmId : les coefficients de la Ferme A ne s’appliquent jamais à un score de la Ferme B', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/layer-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ mortality: { weight: 0.9 } })
      .expect(200);

    const buildingB = await prisma.building.create({
      data: { farmId: farmB.id, name: 'Poulailler Ponte B', type: 'PONTE', createdBy: ownerUserId },
    });
    const resBatchB = await request(app.getHttpServer())
      .post('/api/v1/layer-batches')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({
        entryDate: isoDaysAgo(60),
        initialQuantity: 500,
        buildingId: buildingB.id,
        primaryManagerId: (await prisma.user.findFirstOrThrow({ where: { farmId: farmB.id } })).id,
      })
      .expect(201);
    const batchBId = body<LayerBatchResponseBody>(resBatchB).id;
    createdBatchIds.push(batchBId);

    const scoreB = await getScore(ownerTokenB, batchBId);
    expect(componentByKey(scoreB, 'mortality').weight).toBeCloseTo(0.5); // pas 0.9
  });
});
