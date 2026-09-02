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
 * Prévisions production — Pondeuses (Lot 3). GET /layer-batches/previsions.
 * Couvre : fenêtre glissante de 30 jours (même convention que le Lot 2),
 * seuil de suffisance (3 journées SAISIES, pas juste "avec un mouvement"),
 * exclusion des journées hors fenêtre, exclusion des lots hors cycle
 * (REFORME), état INSUFFISANT explicite, RBAC (LAYER_BATCHES_READ
 * réutilisée), isolation farmId.
 */
jest.setTimeout(30_000);

interface LayerBatchResponseBody {
  id: string;
}
interface LayerForecastBody {
  batchId: string;
  windowDays: number;
  recordDaysInWindow: number;
  dataStatus: 'SUFFISANT' | 'INSUFFISANT';
  averageDailyEggs: number | null;
  projectedEggsNextWindow: number | null;
  projectedLayingRatePercent: number | null;
  calculatedAt: string;
}

const FULL_ACCESS_ROLE = 'Propriétaire / Administrateur';
const NO_ACCESS_ROLE = 'Vendeur / Caisse';

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

describe('Prévisions production — GET /layer-batches/previsions (e2e, Lot 3)', () => {
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
    for (const name of [FULL_ACCESS_ROLE, NO_ACCESS_ROLE]) {
      if (!roleIdByName.has(name)) {
        throw new Error(`Rôle "${name}" introuvable — lancer \`npm run db:seed\` avant les tests.`);
      }
    }

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (layer-forecast e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (layer-forecast e2e ${Date.now()})` },
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
        name: 'Poulailler Pondeuses Prévisions',
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
    eggsLaid: number,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/v1/layer-batches/${batchId}/daily-records`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date, henCount: 1000, eggsLaid })
      .expect(201);
  }

  async function getForecast(token: string): Promise<LayerForecastBody[]> {
    const res = await request(app.getHttpServer())
      .get('/api/v1/layer-batches/previsions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return body<LayerForecastBody[]>(res);
  }

  it('moins de 3 journées saisies dans la fenêtre -> dataStatus INSUFFISANT', async () => {
    const batchId = await createBatch(ownerTokenA);
    await createDailyRecord(ownerTokenA, batchId, isoDaysAgo(2), 900);
    await createDailyRecord(ownerTokenA, batchId, isoDaysAgo(1), 900);

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.batchId === batchId);
    expect(forecast).toBeDefined();
    expect(forecast!.recordDaysInWindow).toBe(2);
    expect(forecast!.dataStatus).toBe('INSUFFISANT');
    expect(forecast!.averageDailyEggs).toBeNull();
    expect(forecast!.projectedLayingRatePercent).toBeNull();
  });

  it('3 journées dans la fenêtre -> dataStatus SUFFISANT, moyenne/projection/taux de ponte cohérents', async () => {
    const batchId = await createBatch(ownerTokenA);
    for (let i = 1; i <= 3; i++) {
      await createDailyRecord(ownerTokenA, batchId, isoDaysAgo(i), 900);
    }

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.batchId === batchId);
    expect(forecast!.dataStatus).toBe('SUFFISANT');
    expect(forecast!.windowDays).toBe(30);
    expect(forecast!.recordDaysInWindow).toBe(3);
    // 2700 / 30 jours = 90/jour.
    expect(forecast!.averageDailyEggs).toBeCloseTo(90, 5);
    expect(forecast!.projectedEggsNextWindow).toBe(2700);
    // 90 / 1000 * 100 = 9 %.
    expect(forecast!.projectedLayingRatePercent).toBeCloseTo(9, 5);
  });

  it('journée hors fenêtre (35 jours) ignorée — ne compte pas dans la moyenne', async () => {
    const batchId = await createBatch(ownerTokenA);
    await createDailyRecord(ownerTokenA, batchId, isoDaysAgo(35), 900);

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.batchId === batchId);
    expect(forecast!.recordDaysInWindow).toBe(0);
    expect(forecast!.dataStatus).toBe('INSUFFISANT');
  });

  it('lot passé en REFORME -> absent de GET /layer-batches/previsions (cycle terminé)', async () => {
    const batchId = await createBatch(ownerTokenA);
    await request(app.getHttpServer())
      .patch(`/api/v1/layer-batches/${batchId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ status: 'REFORME' })
      .expect(200);

    const forecasts = await getForecast(ownerTokenA);
    expect(forecasts.some((f) => f.batchId === batchId)).toBe(false);
  });

  it('aucune permission LAYER_BATCHES_READ -> 403 (RBAC vérifiée sur les permissions du token, pas le rôle affiché)', async () => {
    // Tous les rôles métier du catalogue (y compris Vendeur/Caisse)
    // portent LAYER_BATCHES_READ — voir la même remarque côté
    // broiler-batches-forecast.e2e-spec.ts.
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

    const res = await request(app.getHttpServer())
      .get('/api/v1/layer-batches/previsions')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it('isolation farmId : les prévisions de la Ferme B ne contiennent jamais les lots de la Ferme A', async () => {
    const batchAId = await createBatch(ownerTokenA);

    const forecastsA = await getForecast(ownerTokenA);
    const forecastsB = await getForecast(ownerTokenB);

    expect(forecastsA.some((f) => f.batchId === batchAId)).toBe(true);
    expect(forecastsB.some((f) => f.batchId === batchAId)).toBe(false);
  });
});
