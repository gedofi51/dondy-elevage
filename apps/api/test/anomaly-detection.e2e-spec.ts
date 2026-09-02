import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { TokenService } from '../src/modules/auth/token.service';
import { AnomalyDetectionCronService } from '../src/modules/anomaly-detection/anomaly-detection.cron';
import { ROLES_CATALOG } from '../src/common/rbac/roles.catalog';
import {
  body,
  closeAppSafely,
  createActiveUser,
  type ErrorResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Détection d'anomalies (Lot 4). Couvre : règle croisée Broiler (eau +
 * aliment + mortalité, 3 signaux) et Layer (aliment + mortalité, 2
 * signaux — pas d'eau au niveau LayerDailyRecord, voir DETTE_TECHNIQUE.md),
 * cas déclenchant (décomposition complète dans le message), cas ne
 * déclenchant pas (un seul signal dégradé, règle croisée jamais un seuil
 * isolé), idempotence (un seul passage de cron par jour), filtre
 * `typePrefix` sur GET /alerts, RBAC (ALERTS_READ réutilisée), isolation
 * farmId, non-régression du moteur d'alertes existant (mortalité isolée
 * J toujours déclenchée en parallèle).
 */
jest.setTimeout(30_000);

interface BatchResponseBody {
  id: string;
  code: string;
}
interface AlertResponseBody {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string | null;
  entityId: string | null;
}
interface AlertListResponseBody {
  items: AlertResponseBody[];
  total: number;
}

const FULL_ACCESS_ROLE = 'Propriétaire / Administrateur';
const NO_ACCESS_ROLE = 'Vendeur / Caisse';

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

describe('Détection d’anomalies (e2e, Lot 4)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let cronService: AnomalyDetectionCronService;

  let farmA: { id: string };
  let farmB: { id: string };
  let roleIdByName: Map<string, string>;
  const permissionsByRoleName = new Map(ROLES_CATALOG.map((r) => [r.name, r.permissions]));

  const createdUserIds: string[] = [];
  const createdBroilerBatchIds: string[] = [];
  const createdLayerBatchIds: string[] = [];
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
    cronService = app.get(AnomalyDetectionCronService);

    const roles = await prisma.role.findMany({ where: { farmId: null } });
    roleIdByName = new Map(roles.map((r) => [r.name, r.id]));
    for (const name of [FULL_ACCESS_ROLE, NO_ACCESS_ROLE]) {
      if (!roleIdByName.has(name)) {
        throw new Error(`Rôle "${name}" introuvable — lancer \`npm run db:seed\` avant les tests.`);
      }
    }

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (anomaly e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (anomaly e2e ${Date.now()})` },
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
        name: 'Poulailler Anomalies Test',
        type: 'MIXTE',
        createdBy: ownerUserId,
      },
    });
    buildingId = building.id;
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      // Notification.alertId/userId : les alertes IMPORTANT/CRITIQUE
      // déclenchent des notifications (voir AlertsService.triggerInternal)
      // — à nettoyer avant les alertes elles-mêmes ET avant les
      // utilisateurs (même pitfall que broiler-batches.e2e-spec.ts test 5).
      await prisma.notification.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.alert.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.broilerDailyRecord.deleteMany({
        where: { batchId: { in: createdBroilerBatchIds } },
      });
      await prisma.broilerBatch.deleteMany({ where: { id: { in: createdBroilerBatchIds } } });
      await prisma.eggStockLot.deleteMany({ where: { batchId: { in: createdLayerBatchIds } } });
      await prisma.layerDailyRecord.deleteMany({
        where: { batchId: { in: createdLayerBatchIds } },
      });
      await prisma.layerBatch.deleteMany({ where: { id: { in: createdLayerBatchIds } } });
      await prisma.building.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  async function createBroilerBatch(token: string): Promise<string> {
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
    createdBroilerBatchIds.push(id);
    // Rétro-date de 6 jours : jour courant = J7, veille = J6 -> fenêtre
    // évaluée = J1-J6 (BASELINE J1-J3, RECENT J4-J6), exactement les
    // journées saisies ci-dessous.
    await prisma.broilerBatch.update({
      where: { id },
      data: { arrivalDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
    });
    return id;
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

  async function createLayerBatch(token: string): Promise<string> {
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
    const id = body<BatchResponseBody>(res).id;
    createdLayerBatchIds.push(id);
    return id;
  }

  async function createLayerDailyRecord(
    token: string,
    batchId: string,
    daysAgo: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/v1/layer-batches/${batchId}/daily-records`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: isoDaysAgo(daysAgo), henCount: 1000, eggsLaid: 900, ...payload })
      .expect(201);
  }

  async function getAnomalies(token: string): Promise<AlertResponseBody[]> {
    const res = await request(app.getHttpServer())
      .get('/api/v1/alerts?typePrefix=anomalie_croisee&limit=100')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return body<AlertListResponseBody>(res).items;
  }

  it('Broiler — baisse eau + baisse aliment + hausse mortalité simultanées -> anomalie détectée avec décomposition complète', async () => {
    const batchId = await createBroilerBatch(ownerTokenA);
    // J1-J3 (référence) : eau/aliment stables, mortalité faible.
    for (const day of [1, 2, 3]) {
      await patchDailyRecord(ownerTokenA, batchId, day, {
        waterConsumptionLiters: 80,
        feedDistributedKg: 50,
        mortalityQuantity: 1,
      });
    }
    // J4-J6 (récent) : eau -25 %, aliment -20 %, mortalité en forte hausse.
    for (const day of [4, 5, 6]) {
      await patchDailyRecord(ownerTokenA, batchId, day, {
        waterConsumptionLiters: 60,
        feedDistributedKg: 40,
        mortalityQuantity: 12,
      });
    }

    await cronService.runDailySweep();

    const anomalies = await getAnomalies(ownerTokenA);
    const anomaly = anomalies.find((a) => a.entityId === batchId);
    expect(anomaly).toBeDefined();
    expect(anomaly!.type).toMatch(/^anomalie_croisee_broiler_j\d+$/);
    expect(['IMPORTANT', 'CRITIQUE']).toContain(anomaly!.severity);
    expect(anomaly!.message).toContain('Eau');
    expect(anomaly!.message).toContain('Aliment');
    expect(anomaly!.message).toContain('Mortalité');
    expect(anomaly!.message).toContain('Règle :');
    // Non-régression du moteur d'alertes existant (BroilerAlertsCronService,
    // un cron distinct non invoqué ici) : couverte par la suite e2e
    // complète (broiler-batches.e2e-spec.ts, test 5), pas dupliquée ici.
  });

  it('Broiler — un seul signal dégradé (mortalité seule) -> aucune anomalie (règle croisée, pas un seuil isolé)', async () => {
    const batchId = await createBroilerBatch(ownerTokenA);
    for (const day of [1, 2, 3]) {
      await patchDailyRecord(ownerTokenA, batchId, day, {
        waterConsumptionLiters: 80,
        feedDistributedKg: 50,
        mortalityQuantity: 1,
      });
    }
    for (const day of [4, 5, 6]) {
      await patchDailyRecord(ownerTokenA, batchId, day, {
        // Eau/aliment INCHANGÉS — seule la mortalité augmente.
        waterConsumptionLiters: 80,
        feedDistributedKg: 50,
        mortalityQuantity: 12,
      });
    }

    await cronService.runDailySweep();

    const anomalies = await getAnomalies(ownerTokenA);
    expect(anomalies.some((a) => a.entityId === batchId)).toBe(false);
  });

  it('idempotence : un second passage du cron le même jour ne recrée pas l’anomalie', async () => {
    const batchId = await createBroilerBatch(ownerTokenA);
    for (const day of [1, 2, 3]) {
      await patchDailyRecord(ownerTokenA, batchId, day, {
        waterConsumptionLiters: 80,
        feedDistributedKg: 50,
        mortalityQuantity: 1,
      });
    }
    for (const day of [4, 5, 6]) {
      await patchDailyRecord(ownerTokenA, batchId, day, {
        waterConsumptionLiters: 60,
        feedDistributedKg: 40,
        mortalityQuantity: 12,
      });
    }

    await cronService.runDailySweep();
    await cronService.runDailySweep();

    const count = await prisma.alert.count({
      where: { entityId: batchId, type: { startsWith: 'anomalie_croisee_broiler_' } },
    });
    expect(count).toBe(1);
  });

  it('Pondeuses — baisse aliment + hausse mortalité simultanées -> anomalie détectée (règle à 2 signaux, pas d’eau au niveau lot)', async () => {
    const batchId = await createLayerBatch(ownerTokenA);
    for (const daysAgo of [6, 5, 4]) {
      await createLayerDailyRecord(ownerTokenA, batchId, daysAgo, {
        feedDistributedKg: 120,
        mortalityQuantity: 1,
      });
    }
    for (const daysAgo of [3, 2, 1]) {
      await createLayerDailyRecord(ownerTokenA, batchId, daysAgo, {
        feedDistributedKg: 90,
        mortalityQuantity: 12,
      });
    }

    await cronService.runDailySweep();

    const anomalies = await getAnomalies(ownerTokenA);
    const anomaly = anomalies.find((a) => a.entityId === batchId);
    expect(anomaly).toBeDefined();
    expect(anomaly!.type).toMatch(/^anomalie_croisee_layer_\d{4}-\d{2}-\d{2}$/);
    expect(anomaly!.message).toContain('Aliment');
    expect(anomaly!.message).toContain('Mortalité');
    expect(anomaly!.message).not.toContain('Eau');
  });

  it(`${NO_ACCESS_ROLE} : aucune permission ALERTS_READ -> 403 sur GET /alerts?typePrefix=`, async () => {
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
      .get('/api/v1/alerts?typePrefix=anomalie_croisee')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it('isolation farmId : les anomalies de la Ferme A ne sont jamais visibles depuis la Ferme B', async () => {
    const batchId = await createBroilerBatch(ownerTokenA);
    for (const day of [1, 2, 3]) {
      await patchDailyRecord(ownerTokenA, batchId, day, {
        waterConsumptionLiters: 80,
        feedDistributedKg: 50,
        mortalityQuantity: 1,
      });
    }
    for (const day of [4, 5, 6]) {
      await patchDailyRecord(ownerTokenA, batchId, day, {
        waterConsumptionLiters: 60,
        feedDistributedKg: 40,
        mortalityQuantity: 12,
      });
    }

    await cronService.runDailySweep();

    const anomaliesA = await getAnomalies(ownerTokenA);
    const anomaliesB = await getAnomalies(ownerTokenB);
    expect(anomaliesA.some((a) => a.entityId === batchId)).toBe(true);
    expect(anomaliesB.some((a) => a.entityId === batchId)).toBe(false);
  });
});
