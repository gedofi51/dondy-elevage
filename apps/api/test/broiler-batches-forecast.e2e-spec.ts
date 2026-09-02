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
 * Prévisions production — Poulets de chair (Lot 3). GET
 * /broiler-batches/previsions. Couvre : mortalityDataStatus/
 * weightDataStatus indépendants, extrapolation linéaire de la mortalité,
 * GMQ tendance réutilisé pour la projection de poids, exclusion des
 * bandes hors cycle (annulée), état INSUFFISANT explicite (jamais un
 * chiffre inventé), RBAC (BROILER_BATCHES_READ réutilisée), isolation
 * farmId.
 */
jest.setTimeout(30_000);

interface BatchResponseBody {
  id: string;
  code: string;
}
interface BroilerForecastBody {
  batchId: string;
  elapsedDays: number;
  remainingDays: number;
  mortalityDataStatus: 'SUFFISANT' | 'INSUFFISANT';
  projectedAdditionalMortality: number | null;
  projectedSellableCount: number | null;
  weightDataStatus: 'SUFFISANT' | 'INSUFFISANT';
  gmqTrendGramsPerDay: number | null;
  projectedFinalWeightG: number | null;
  calculatedAt: string;
}

const FULL_ACCESS_ROLE = 'Propriétaire / Administrateur';
const NO_ACCESS_ROLE = 'Vendeur / Caisse';

describe('Prévisions production — GET /broiler-batches/previsions (e2e, Lot 3)', () => {
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
      data: { name: `Ferme Test A (broiler-forecast e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (broiler-forecast e2e ${Date.now()})` },
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
        name: 'Poulailler Prévisions Test',
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
      await prisma.building.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  async function createBatch(
    token: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
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
        ...overrides,
      })
      .expect(201);
    const id = body<BatchResponseBody>(res).id;
    createdBatchIds.push(id);
    return id;
  }

  /** CreateBroilerBatchDto n'expose pas `status` (toujours BROUILLON à la
   * création, hors PROJECTABLE_BROILER_STATUSES par construction) — mise
   * à jour directe en base, pas de round-trip PATCH inutile pour ce
   * fichier de tests. */
  async function createInProgressBatch(
    token: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const id = await createBatch(token, overrides);
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

  async function getForecast(token: string): Promise<BroilerForecastBody[]> {
    const res = await request(app.getHttpServer())
      .get('/api/v1/broiler-batches/previsions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return body<BroilerForecastBody[]>(res);
  }

  it('bande en BROUILLON (statut par défaut à la création) -> absente de GET /broiler-batches/previsions (cycle pas encore démarré)', async () => {
    const batchId = await createBatch(ownerTokenA);

    const forecasts = await getForecast(ownerTokenA);
    expect(forecasts.some((f) => f.batchId === batchId)).toBe(false);
  });

  it('bande en cycle fraîchement démarrée -> mortalityDataStatus et weightDataStatus INSUFFISANT (jamais un chiffre inventé)', async () => {
    const batchId = await createInProgressBatch(ownerTokenA);

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.batchId === batchId);
    expect(forecast).toBeDefined();
    expect(forecast!.elapsedDays).toBe(0);
    expect(forecast!.mortalityDataStatus).toBe('INSUFFISANT');
    expect(forecast!.projectedAdditionalMortality).toBeNull();
    expect(forecast!.projectedSellableCount).toBeNull();
    expect(forecast!.weightDataStatus).toBe('INSUFFISANT');
    expect(forecast!.projectedFinalWeightG).toBeNull();
    expect(forecast!.calculatedAt).toBeTruthy();
  });

  it('mortalité régulière sur 10 jours (bande rétro-datée) -> extrapolation linéaire cohérente sur les jours restants', async () => {
    const batchId = await createInProgressBatch(ownerTokenA, {
      plannedSaleDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await backdateArrival(batchId, 10);
    // 4 morts/jour sur les journées J1..J5 = 20 morts cumulées.
    for (let day = 1; day <= 5; day++) {
      await patchDailyRecord(ownerTokenA, batchId, day, { mortalityQuantity: 4 });
    }

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.batchId === batchId);
    expect(forecast!.elapsedDays).toBe(10);
    expect(forecast!.mortalityDataStatus).toBe('SUFFISANT');
    // Taux journalier = 20/10 = 2/jour. remainingDays dérivé de la réponse
    // (pas codé en dur à 35) : le délai réel entre la fixation de
    // plannedSaleDate (à la création) et cet appel peut faire flotter
    // remainingDays d'une unité (34 ou 35) selon la vitesse d'exécution —
    // même principe que treasury-forecast.e2e-spec.ts.
    const expectedAdditionalMortality = Math.round((20 / 10) * forecast!.remainingDays);
    expect(forecast!.projectedAdditionalMortality).toBe(expectedAdditionalMortality);
    expect(forecast!.projectedSellableCount).toBe(980 - expectedAdditionalMortality);
  });

  it('2 pesées enregistrées -> weightDataStatus SUFFISANT, GMQ tendance et poids final projeté', async () => {
    const batchId = await createInProgressBatch(ownerTokenA, {
      plannedSaleDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await backdateArrival(batchId, 10);
    await patchDailyRecord(ownerTokenA, batchId, 5, { sampleSize: 10, totalSampleWeightG: 1000 }); // 100g
    await patchDailyRecord(ownerTokenA, batchId, 10, { sampleSize: 10, totalSampleWeightG: 2500 }); // 250g

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.batchId === batchId);
    expect(forecast!.weightDataStatus).toBe('SUFFISANT');
    // GMQ = (250-100)/(10-5) = 30 g/j.
    expect(forecast!.gmqTrendGramsPerDay).toBe(30);
    expect(forecast!.projectedFinalWeightG).toBeGreaterThan(250);
  });

  it('bande en cycle annulée -> absente de GET /broiler-batches/previsions (cycle terminé, rien à projeter)', async () => {
    const batchId = await createInProgressBatch(ownerTokenA);
    await request(app.getHttpServer())
      .post(`/api/v1/broiler-batches/${batchId}/annuler`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(201);

    const forecasts = await getForecast(ownerTokenA);
    expect(forecasts.some((f) => f.batchId === batchId)).toBe(false);
  });

  it('aucune permission BROILER_BATCHES_READ -> 403 (RBAC vérifiée sur les permissions du token, pas le rôle affiché)', async () => {
    // Tous les rôles métier du catalogue (y compris Vendeur/Caisse)
    // portent BROILER_BATCHES_READ — les bandes sont une donnée
    // transverse (ventes, stocks, dépenses en dépendent). Le token
    // signé (jamais un nom de rôle en dur, voir PermissionsGuard) est
    // donc la seule façon fiable de tester ce refus.
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
      .get('/api/v1/broiler-batches/previsions')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it('isolation farmId : les prévisions de la Ferme B ne contiennent jamais les bandes de la Ferme A', async () => {
    const batchAId = await createInProgressBatch(ownerTokenA);

    const forecastsA = await getForecast(ownerTokenA);
    const forecastsB = await getForecast(ownerTokenB);

    expect(forecastsA.some((f) => f.batchId === batchAId)).toBe(true);
    expect(forecastsB.some((f) => f.batchId === batchAId)).toBe(false);
  });
});
