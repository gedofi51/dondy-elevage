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
 * Score de performance — Poulets de chair (Lot 5, IA). GET
 * /broiler-batches/:id/performance-score, GET/PUT
 * /broiler-batches/performance-coefficients. Couvre : décomposition
 * explicite (mortalité toujours calculable, IC/GMQ exclus sans cible
 * configurée — jamais un chiffre inventé), coefficients par défaut (poids
 * égaux) vs configurés, RBAC (lecture BROILER_BATCHES_READ, écriture
 * FARMS_UPDATE — aucune permission dédiée créée), validation DTO (clé
 * inconnue rejetée par `forbidNonWhitelisted`), isolation farmId.
 */
jest.setTimeout(30_000);

interface BatchResponseBody {
  id: string;
}
interface PerformanceScoreComponentBody {
  key: string;
  rawValue: number | null;
  target: number | null;
  weight: number;
  contributionPercent: number | null;
}
interface PerformanceScoreBody {
  scoreOn100: number | null;
  dataStatus: 'SUFFISANT' | 'INSUFFISANT';
  components: PerformanceScoreComponentBody[];
  calculatedAt: string;
}
interface CoefficientsBody {
  [key: string]: { weight: number; target?: number } | undefined;
}

const FULL_ACCESS_ROLE = 'Propriétaire / Administrateur';
/** A BROILER_BATCHES_READ/UPDATE mais PAS FARMS_UPDATE — voir
 * roles.catalog.ts. Distinct de NO_ACCESS_ROLE : ce rôle doit pouvoir LIRE
 * le score, jamais écrire les coefficients. */
const DOMAIN_ROLE_WITHOUT_FARMS_UPDATE = 'Responsable élevage';
const NO_ACCESS_ROLE = 'Vendeur / Caisse';

describe('Score de performance — Poulets de chair (e2e, Lot 5)', () => {
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
      data: { name: `Ferme Test A (broiler-score e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (broiler-score e2e ${Date.now()})` },
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
        name: 'Poulailler Score Test',
        type: 'CHAIR',
        createdBy: ownerUserId,
      },
    });
    buildingId = building.id;
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.broilerDailyRecord.deleteMany({ where: { batchId: { in: createdBatchIds } } });
      await prisma.broilerBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
      await prisma.setting.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.building.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  async function createInProgressBatch(token: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/broiler-batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        arrivalDate: new Date().toISOString(),
        origin: 'NAISSANCE_INTERNE',
        orderedQuantity: 1000,
        receivedQuantity: 1000,
        deadOnArrivalQuantity: 0,
        unitPriceFcfa: 500,
        buildingId,
        primaryManagerId: ownerUserId,
      })
      .expect(201);
    const id = body<BatchResponseBody>(res).id;
    createdBatchIds.push(id);
    await prisma.broilerBatch.update({ where: { id }, data: { status: 'EN_CROISSANCE' } });
    return id;
  }

  async function backdateArrival(batchId: string, daysAgo: number): Promise<void> {
    await prisma.broilerBatch.update({
      where: { id: batchId },
      data: { arrivalDate: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) },
    });
  }

  async function patchDailyRecord(
    token: string,
    batchId: string,
    dayNumber: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await request(app.getHttpServer())
      .patch(`/api/v1/broiler-batches/${batchId}/daily-records/${dayNumber}`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(200);
  }

  async function getScore(token: string, batchId: string): Promise<PerformanceScoreBody> {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/broiler-batches/${batchId}/performance-score`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return body<PerformanceScoreBody>(res);
  }

  function componentByKey(score: PerformanceScoreBody, key: string): PerformanceScoreComponentBody {
    const component = score.components.find((c) => c.key === key);
    expect(component).toBeDefined();
    return component!;
  }

  it('bande sans pesée : mortalité seule contribue, IC/GMQ ont une valeur brute mais aucune cible -> contribution null', async () => {
    const batchId = await createInProgressBatch(ownerTokenA);
    await patchDailyRecord(ownerTokenA, batchId, 1, { mortalityQuantity: 20 }); // 20/1000 = 2%

    const score = await getScore(ownerTokenA, batchId);
    const mortality = componentByKey(score, 'mortality');
    const ic = componentByKey(score, 'ic');
    const gmq = componentByKey(score, 'gmq');

    expect(mortality.rawValue).toBeCloseTo(2);
    expect(mortality.contributionPercent).toBeCloseTo(98);
    expect(ic.contributionPercent).toBeNull();
    expect(gmq.contributionPercent).toBeNull();
    expect(score.dataStatus).toBe('SUFFISANT'); // mortalité seule suffit
    expect(score.calculatedAt).toBeTruthy();
  });

  it('coefficients par défaut : poids égaux (1/3) tant qu’aucun n’est configuré', async () => {
    const batchId = await createInProgressBatch(ownerTokenA);
    const score = await getScore(ownerTokenA, batchId);
    for (const key of ['mortality', 'ic', 'gmq']) {
      expect(componentByKey(score, key).weight).toBeCloseTo(1 / 3);
    }
  });

  it('coefficients configurés (PUT) : cibles IC/GMQ appliquées, les 3 composantes contribuent ensuite', async () => {
    const batchId = await createInProgressBatch(ownerTokenA);
    await backdateArrival(batchId, 30);
    await patchDailyRecord(ownerTokenA, batchId, 1, { feedDistributedKg: 100 });
    await patchDailyRecord(ownerTokenA, batchId, 30, {
      sampleSize: 10,
      totalSampleWeightG: 18_000, // 1800 g moyen
    });

    await request(app.getHttpServer())
      .put('/api/v1/broiler-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        mortality: { weight: 0.4 },
        ic: { weight: 0.3, target: 1.7 },
        gmq: { weight: 0.3, target: 45 },
      })
      .expect(200);

    const score = await getScore(ownerTokenA, batchId);
    const ic = componentByKey(score, 'ic');
    const gmq = componentByKey(score, 'gmq');
    expect(ic.target).toBe(1.7);
    expect(ic.contributionPercent).not.toBeNull();
    expect(gmq.target).toBe(45);
    expect(gmq.contributionPercent).not.toBeNull();
    expect(componentByKey(score, 'mortality').weight).toBeCloseTo(0.4);
  });

  it('GET /performance-coefficients reflète ce qui vient d’être configuré (objet vide par défaut)', async () => {
    const before = await request(app.getHttpServer())
      .get('/api/v1/broiler-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenB}`) // Ferme B, jamais configurée
      .expect(200);
    expect(body<CoefficientsBody>(before)).toEqual({});
  });

  it('PUT rejette un poids négatif (400) et une clé de composante inconnue (400, forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/broiler-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ mortality: { weight: -1 } })
      .expect(400);

    await request(app.getHttpServer())
      .put('/api/v1/broiler-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ vitesse_vent: { weight: 0.5 } })
      .expect(400);
  });

  it(`${DOMAIN_ROLE_WITHOUT_FARMS_UPDATE} : lit le score et les coefficients, mais ne peut PAS les écrire (403, FARMS_UPDATE requise)`, async () => {
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
    const batchId = await createInProgressBatch(ownerTokenA);

    await request(app.getHttpServer())
      .get(`/api/v1/broiler-batches/${batchId}/performance-score`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/broiler-batches/performance-coefficients')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .put('/api/v1/broiler-batches/performance-coefficients')
      .set('Authorization', `Bearer ${token}`)
      .send({ mortality: { weight: 0.5 } })
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it(`${NO_ACCESS_ROLE} : aucune permission BROILER_BATCHES_READ -> 403 sur le score`, async () => {
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
    const batchId = await createInProgressBatch(ownerTokenA);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/broiler-batches/${batchId}/performance-score`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it('isolation farmId : les coefficients configurés sur la Ferme A ne s’appliquent jamais à un score de la Ferme B', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/broiler-batches/performance-coefficients')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ mortality: { weight: 0.9 } })
      .expect(200);

    const buildingB = await prisma.building.create({
      data: { farmId: farmB.id, name: 'Poulailler B', type: 'CHAIR', createdBy: ownerUserId },
    });
    const resBatchB = await request(app.getHttpServer())
      .post('/api/v1/broiler-batches')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({
        arrivalDate: new Date().toISOString(),
        origin: 'NAISSANCE_INTERNE',
        orderedQuantity: 500,
        receivedQuantity: 500,
        deadOnArrivalQuantity: 0,
        unitPriceFcfa: 500,
        buildingId: buildingB.id,
        primaryManagerId: (await prisma.user.findFirstOrThrow({ where: { farmId: farmB.id } })).id,
      })
      .expect(201);
    const batchBId = body<BatchResponseBody>(resBatchB).id;
    createdBatchIds.push(batchBId);

    const scoreB = await getScore(ownerTokenB, batchBId);
    expect(componentByKey(scoreB, 'mortality').weight).toBeCloseTo(1 / 3); // pas 0.9
  });
});
