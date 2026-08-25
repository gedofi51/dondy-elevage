import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { BroilerAlertsCronService } from '../src/modules/broiler-batches/broiler-alerts.cron';
import {
  body,
  closeAppSafely,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Scénario d'acceptation V1 §25, rejoué de bout en bout contre une vraie
 * base MySQL (pas de mocks) : création de bande → 45 journées générées →
 * mortalité → alimentation → pesée → alerte calendaire J40 → vente
 * partielle → vente finale → paiement → clôture avec résumé de cohérence.
 *
 * Adaptation assumée : §25 énumère "3 morts → effectif 997" PUIS "vente de
 * 300 sur 950 disponibles" — ces deux chiffres ne s'enchaînent pas
 * arithmétiquement au sein d'un même scénario continu (997 ≠ 950). Ce test
 * suit un seul fil continu et cohérent (997 disponibles, pas 950) plutôt que
 * de forcer un chiffre du cahier qui ne découle pas du précédent — chaque
 * capacité décrite par §25 est néanmoins exercée fidèlement.
 */
jest.setTimeout(30_000);

interface BatchResponseBody {
  id: string;
  code: string;
  status: string;
  startedQuantity: number;
  currentHeadcount: number;
  chickCostFcfa: number;
  totalAcquisitionCostFcfa: number;
}
interface DailyRecordResponseBody {
  id: string;
  dayNumber: number;
  feedDistributedKg: string | null;
  averageWeightG: number | null;
  mortalityQuantity: number;
}
interface SaleResponseBody {
  id: string;
  saleNumber: string;
  status: string;
  quantity: number;
  netAmountFcfa: number;
}
interface PaymentResponseBody {
  id: string;
  amountFcfa: number;
}
interface ClosureResponseBody {
  batch: BatchResponseBody;
  summary: {
    production: { cumulativeMortality: number; soldCount: number };
    performance: { finalAverageWeightG: number | null };
    finances: { revenueFcfa: number; totalExpensesFcfa: number };
    coherence: { isCoherent: boolean };
  };
}

describe('Broiler batches — cycle de vie complet (e2e, scénario §25)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let cronService: BroilerAlertsCronService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;
  let lecteurRoleId: string;
  let buildingId: string;
  let supplierId: string;
  let customerId: string;
  let ownerUserId: string;
  let ownerToken: string;

  const createdUserIds: string[] = [];
  const createdBatchIds: string[] = [];

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
    cronService = app.get(BroilerAlertsCronService);

    const roles = await prisma.role.findMany({ where: { farmId: null } });
    const proprietaireRole = roles.find((r) => r.name === 'Propriétaire / Administrateur');
    const lecteurRole = roles.find((r) => r.name === 'Lecteur / Lecture seule');
    if (!proprietaireRole || !lecteurRole) {
      throw new Error(
        'Référentiel de rôles Phase 1 introuvable — lancer `npm run db:seed` avant les tests.',
      );
    }
    proprietaireRoleId = proprietaireRole.id;
    lecteurRoleId = lecteurRole.id;

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (broiler e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (broiler e2e ${Date.now()})` },
    });

    const { id: userId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      proprietaireRoleId,
      'OwnerBroilerTest!2026',
    );
    ownerUserId = userId;
    createdUserIds.push(userId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'OwnerBroilerTest!2026' })
      .expect(200);
    ownerToken = body<LoginResponseBody>(loginRes).accessToken!;

    const building = await prisma.building.create({
      data: { farmId: farmA.id, name: 'Poulailler Test', type: 'CHAIR', createdBy: ownerUserId },
    });
    buildingId = building.id;

    const supplier = await prisma.supplier.create({
      data: {
        farmId: farmA.id,
        name: 'Couvoir Test',
        category: 'poussins',
        createdBy: ownerUserId,
      },
    });
    supplierId = supplier.id;

    const customer = await prisma.customer.create({
      data: { farmId: farmA.id, code: 'CLI-TEST01', name: 'Restaurant Test', type: 'RESTAURANT' },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    // closeAppSafely : app.close() s'exécute même si le nettoyage échoue
    // — voir DETTE_TECHNIQUE.md (incident Phase 8/16, généralisé en
    // helper partagé).
    await closeAppSafely(app, async () => {
      // Ordre sûr vis-à-vis des FK : paiements -> ventes -> dépenses ->
      // santé/mortalité/suivi quotidien -> bandes -> références -> utilisateurs -> fermes.
      const sales = await prisma.sale.findMany({ where: { batchId: { in: createdBatchIds } } });
      await prisma.payment.deleteMany({ where: { saleId: { in: sales.map((s) => s.id) } } });
      await prisma.sale.deleteMany({ where: { batchId: { in: createdBatchIds } } });
      await prisma.expense.deleteMany({ where: { batchId: { in: createdBatchIds } } });
      await prisma.broilerHealthEvent.deleteMany({ where: { batchId: { in: createdBatchIds } } });
      await prisma.broilerMortality.deleteMany({ where: { batchId: { in: createdBatchIds } } });
      await prisma.broilerDailyRecord.deleteMany({ where: { batchId: { in: createdBatchIds } } });
      // Le cron déclenche des notifications sur les alertes IMPORTANT/CRITIQUE
      // (voir test 5, alerte J40) — à nettoyer avant les alertes elles-mêmes
      // (Notification.alertId) et avant les utilisateurs (Notification.userId).
      await prisma.notification.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.alert.deleteMany({ where: { entityId: { in: createdBatchIds } } });
      await prisma.broilerBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
      await prisma.customer.deleteMany({ where: { id: customerId } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
      await prisma.building.deleteMany({ where: { id: buildingId } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  let batchId: string;

  it('1. crée une bande de 1000 poussins → code auto PC-AAAA-NNN, 45 journées générées', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/broiler-batches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        arrivalDate: new Date().toISOString(),
        origin: 'ACHAT',
        supplierId,
        orderedQuantity: 1000,
        receivedQuantity: 1000,
        deadOnArrivalQuantity: 0,
        unitPriceFcfa: 500,
        buildingId,
        primaryManagerId: ownerUserId,
      })
      .expect(201);
    const batch = body<BatchResponseBody>(res);
    expect(batch.code).toMatch(/^PC-\d{4}-\d{3}$/);
    expect(batch.startedQuantity).toBe(1000);
    expect(batch.currentHeadcount).toBe(1000);
    batchId = batch.id;
    createdBatchIds.push(batchId);

    const dailyRes = await request(app.getHttpServer())
      .get(`/api/v1/broiler-batches/${batchId}/daily-records`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<DailyRecordResponseBody[]>(dailyRes)).toHaveLength(45);
  });

  it('2. saisit 3 morts (J1) → effectif vivant recalculé à 997', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/broiler-batches/${batchId}/daily-records/1`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ mortalityQuantity: 3 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/broiler-batches/${batchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<BatchResponseBody>(res).currentHeadcount).toBe(997);
  });

  it('3. distribue 50 kg d’aliment → consommation mise à jour', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/broiler-batches/${batchId}/daily-records/1`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ feedDistributedKg: 50 })
      .expect(200);
    expect(Number(body<DailyRecordResponseBody>(res).feedDistributedKg)).toBe(50);
  });

  it('4. pèse 10 poulets pour 12,4 kg → poids moyen calculé à 1,24 kg (1240 g)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/broiler-batches/${batchId}/daily-records/1`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sampleSize: 10, totalSampleWeightG: 12_400 })
      .expect(200);
    expect(body<DailyRecordResponseBody>(res).averageWeightG).toBe(1240);
  });

  it('5. passage à J40 (rétro-daté) → alerte calendaire "vente prévue dans 5 jours" (IMPORTANT)', async () => {
    const arrivalDate39DaysAgo = new Date(Date.now() - 39 * 24 * 60 * 60 * 1000);
    await prisma.broilerBatch.update({
      where: { id: batchId },
      data: { arrivalDate: arrivalDate39DaysAgo },
    });

    await cronService.runDailySweep();

    const alerts = await prisma.alert.findMany({
      where: { entityId: batchId, type: 'batch_calendar_j40' },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe('IMPORTANT');
    expect(alerts[0]!.status).toBe('TRIGGERED');

    // Restaure une date d'arrivée récente pour ne pas fausser les étapes suivantes.
    await prisma.broilerBatch.update({ where: { id: batchId }, data: { arrivalDate: new Date() } });
  });

  it('6. refuse la clôture tant que des animaux restent disponibles (409)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/broiler-batches/${batchId}/cloturer`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);
  });

  let firstSaleId: string;

  it('7. vend 300 sur 997 disponibles à 6000 FCFA → 697 disponibles après confirmation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        batchId,
        date: new Date().toISOString(),
        customerId,
        saleMode: 'UNITE',
        quantity: 300,
        unitPriceFcfa: 6000,
        status: 'CONFIRMEE',
      })
      .expect(201);
    const sale = body<SaleResponseBody>(res);
    expect(sale.netAmountFcfa).toBe(1_800_000);
    firstSaleId = sale.id;

    const batchRes = await request(app.getHttpServer())
      .get(`/api/v1/broiler-batches/${batchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<BatchResponseBody>(batchRes).currentHeadcount).toBe(697);
  });

  it('8. refuse une vente dépassant l’effectif disponible (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        batchId,
        date: new Date().toISOString(),
        customerId,
        saleMode: 'UNITE',
        quantity: 10_000,
        unitPriceFcfa: 6000,
      })
      .expect(409);
  });

  it('9. enregistre le paiement intégral de la première vente → statut PAYEE', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        saleId: firstSaleId,
        date: new Date().toISOString(),
        method: 'especes',
        amountFcfa: 1_800_000,
      })
      .expect(201);
    expect(body<PaymentResponseBody>(res).amountFcfa).toBe(1_800_000);

    const saleRes = await request(app.getHttpServer())
      .get(`/api/v1/sales/${firstSaleId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<SaleResponseBody>(saleRes).status).toBe('PAYEE');
  });

  it('10. vend le solde (697) → 0 disponible, chiffre d’affaires cumulé cohérent', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        batchId,
        date: new Date().toISOString(),
        customerId,
        saleMode: 'UNITE',
        quantity: 697,
        unitPriceFcfa: 6000,
        status: 'CONFIRMEE',
      })
      .expect(201);
    expect(body<SaleResponseBody>(res).netAmountFcfa).toBe(4_182_000);

    const batchRes = await request(app.getHttpServer())
      .get(`/api/v1/broiler-batches/${batchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<BatchResponseBody>(batchRes).currentHeadcount).toBe(0);
  });

  it('11. clôture la bande → résumé de cohérence, effectif nul confirmé, statut CLOTUREE', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/broiler-batches/${batchId}/cloturer`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const closure = body<ClosureResponseBody>(res);

    expect(closure.batch.status).toBe('CLOTUREE');
    expect(closure.summary.production.cumulativeMortality).toBe(3);
    expect(closure.summary.production.soldCount).toBe(997);
    expect(closure.summary.performance.finalAverageWeightG).toBe(1240);
    // 1 800 000 (vente 1) + 4 182 000 (vente 2) = 5 982 000
    expect(closure.summary.finances.revenueFcfa).toBe(5_982_000);
    // Aucune BroilerMortality détaillée saisie dans ce scénario -> rien à
    // comparer, donc réputé cohérent par construction.
    expect(closure.summary.coherence.isCoherent).toBe(true);
  });

  describe('Isolation farmId et RBAC', () => {
    let readerBToken: string;

    beforeAll(async () => {
      const { id, email } = await createActiveUser(
        prisma,
        passwordService,
        farmB.id,
        lecteurRoleId,
        'ReaderBBroilerTest!2026',
      );
      createdUserIds.push(id);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email, password: 'ReaderBBroilerTest!2026' })
        .expect(200);
      readerBToken = body<LoginResponseBody>(res).accessToken!;
    });

    it('GET /broiler-batches/:id d’une bande de la ferme A avec un token de la ferme B → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/broiler-batches/${batchId}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('un Lecteur (lecture seule) ne peut pas créer de bande — 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/broiler-batches')
        .set('Authorization', `Bearer ${readerBToken}`)
        .send({
          arrivalDate: new Date().toISOString(),
          origin: 'NAISSANCE_INTERNE',
          orderedQuantity: 100,
          receivedQuantity: 100,
          unitPriceFcfa: 500,
          buildingId,
          primaryManagerId: ownerUserId,
        })
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });
  });

  describe('Expenses et HealthEvents (smoke test)', () => {
    it('crée une dépense rattachée à la bande', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          batchId,
          date: new Date().toISOString(),
          category: 'aliments',
          amountFcfa: 25_000,
        })
        .expect(201);
      expect(body<{ category: string }>(res).category).toBe('aliments');
    });

    it('crée un événement sanitaire (vaccination) rattaché à la bande', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/broiler-batches/${batchId}/health-events`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ date: new Date().toISOString(), type: 'VACCINATION', status: 'REALISE' })
        .expect(201);
      expect(body<{ type: string }>(res).type).toBe('VACCINATION');
    });
  });

  /**
   * Phase 8 — durcissement de la dette transversale "disponibilité sans
   * verrou" (ouverte depuis la Phase 3, voir DETTE_TECHNIQUE.md). Même
   * gabarit que "Concurrence FIFO" (layer-batches.e2e-spec.ts) : vérifie le
   * verrouillage SELECT ... FOR UPDATE de BroilerBatchesService.
   * assertAvailableHeadcountInTransaction.
   */
  describe('Concurrence — deux ventes de poulets simultanées dépassant l’effectif disponible', () => {
    let concurrencyBatchId: string;

    beforeAll(async () => {
      const batchRes = await request(app.getHttpServer())
        .post('/api/v1/broiler-batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          arrivalDate: new Date().toISOString(),
          origin: 'ACHAT',
          supplierId,
          orderedQuantity: 300,
          receivedQuantity: 300,
          deadOnArrivalQuantity: 0,
          unitPriceFcfa: 500,
          buildingId,
          primaryManagerId: ownerUserId,
        })
        .expect(201);
      concurrencyBatchId = body<BatchResponseBody>(batchRes).id;
      createdBatchIds.push(concurrencyBatchId);
    });

    it('exactement une des deux ventes concurrentes réussit, l’autre est rejetée proprement (409), effectif final cohérent', async () => {
      // 300 disponibles — deux ventes de 200 sont chacune individuellement
      // valides, mais 200 + 200 = 400 > 300.
      const sendSale = () =>
        request(app.getHttpServer())
          .post('/api/v1/sales')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            productType: 'POULET_CHAIR',
            batchId: concurrencyBatchId,
            date: new Date().toISOString(),
            customerId,
            saleMode: 'UNITE',
            quantity: 200,
            unitPriceFcfa: 3_000,
            status: 'CONFIRMEE',
          });

      const [resA, resB] = await Promise.all([sendSale(), sendSale()]);
      const statuses = [resA.status, resB.status].sort();

      // Ni les deux ne réussissent (survente), ni les deux n'échouent
      // (perte de disponibilité légitime) — exactement une des deux, et
      // l'échec est un 409 métier propre, jamais un 500 non géré.
      expect(statuses).toEqual([201, 409]);

      const batchAfterRes = await request(app.getHttpServer())
        .get(`/api/v1/broiler-batches/${concurrencyBatchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      // Une seule vente a pu être confirmée : 300 - 200 = 100 restants
      // (jamais 300 - 400 = -100, jamais un double décompte).
      expect(body<BatchResponseBody>(batchAfterRes).currentHeadcount).toBe(100);

      const salesRes = await request(app.getHttpServer())
        .get(`/api/v1/sales?batchId=${concurrencyBatchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(body<SaleResponseBody[]>(salesRes)).toHaveLength(1);
    });
  });
});
