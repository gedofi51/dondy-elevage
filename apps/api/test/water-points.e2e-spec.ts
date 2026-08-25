import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { WaterAlertsCronService } from '../src/modules/water-points/water-alerts.cron';
import {
  body,
  closeAppSafely,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Scénario d'acceptation V5 §16-E, rejoué de bout en bout contre une vraie
 * base MySQL (pas de mocks) : point d'eau → relevé (index 120 -> 128,
 * 8 m³, tarif appliqué, encaissement sans écart) → vente comptoir + vente
 * client identifié → rapprochement informatif Sale(EAU) vs caisse →
 * rejet des trois contrôles §7.3 (index soir < matin sans motif, index
 * matin incohérent avec le dernier relevé sans motif, écart non justifié)
 * → verrouillage de l'index initial → garde-fou de suppression → KPI
 * agrégé → isolation farmId → RBAC.
 *
 * Pas de test de concurrence dédié — voir le commentaire en tête de
 * water-alerts.cron.ts / le plan Phase 6, section "Concurrence" : la
 * vente d'eau n'a structurellement aucune vérification de disponibilité/
 * stock, donc aucune fenêtre de course comparable à POULET_CHAIR/OEUFS/
 * POUSSINS — ce n'est pas de la dette différée, le problème n'existe pas
 * ici. Voir aussi docs/architecture/DETTE_TECHNIQUE.md, section Phase 6.
 */
jest.setTimeout(30_000);

const DAY1 = new Date('2026-08-01T00:00:00.000Z');
const DAY2 = new Date('2026-08-02T00:00:00.000Z');
const DAY3 = new Date('2026-08-03T00:00:00.000Z');

interface WaterPointResponseBody {
  id: string;
  code: string;
  status: string;
  initialIndex: string;
  tariffFcfaPerM3: number;
}
interface WaterReadingResponseBody {
  id: string;
  date: string;
  indexMatin: string;
  indexSoir: string;
  consumptionM3: string;
  tariffFcfaPerM3Snapshot: number;
  theoreticalAmountFcfa: number;
  cashAmountFcfa: number;
  varianceFcfa: number;
  salesCashGapFcfa: number;
}
interface SaleResponseBody {
  id: string;
  saleNumber: string;
  productType: string;
  quantity: number;
  netAmountFcfa: number;
  customerId: string | null;
}
interface WaterPointKpiResponseBody {
  totalConsumptionM3: number;
  totalTheoreticalAmountFcfa: number;
  totalCashAmountFcfa: number;
  totalVarianceFcfa: number;
  averageConsumptionM3: number;
  availabilityRatePercent: number;
  receivablesFcfa: number;
  totalExpensesFcfa: number;
  grossMarginFcfa: number;
  profitabilityRate: number;
}

describe("Vente et distribution d'eau — cycle complet (e2e, scénario §16-E)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let waterCronService: WaterAlertsCronService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;
  let lecteurRoleId: string;
  let customerId: string;
  let ownerUserId: string;
  let ownerToken: string;

  const createdUserIds: string[] = [];
  const createdWaterPointIds: string[] = [];

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
    waterCronService = app.get(WaterAlertsCronService);

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

    farmA = await prisma.farm.create({ data: { name: `Ferme Test A (water e2e ${Date.now()})` } });
    farmB = await prisma.farm.create({ data: { name: `Ferme Test B (water e2e ${Date.now()})` } });

    const { id: userId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      proprietaireRoleId,
      'OwnerWaterTest!2026',
    );
    ownerUserId = userId;
    createdUserIds.push(userId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'OwnerWaterTest!2026' })
      .expect(200);
    ownerToken = body<LoginResponseBody>(loginRes).accessToken!;

    const customer = await prisma.customer.create({
      data: {
        farmId: farmA.id,
        code: 'CLI-TEST04',
        name: 'Riverain Test',
        type: 'PARTICULIER',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    // closeAppSafely : app.close() s'exécute même si le nettoyage échoue
    // — voir DETTE_TECHNIQUE.md (incident Phase 8/16, généralisé en
    // helper partagé).
    await closeAppSafely(app, async () => {
      // Ordre sûr vis-à-vis des FK : paiements -> ventes -> relevés -> points
      // d'eau -> notifications -> alertes -> références -> utilisateurs -> fermes.
      const sales = await prisma.sale.findMany({
        where: { waterPointId: { in: createdWaterPointIds } },
      });
      await prisma.payment.deleteMany({ where: { saleId: { in: sales.map((s) => s.id) } } });
      await prisma.sale.deleteMany({ where: { waterPointId: { in: createdWaterPointIds } } });
      await prisma.waterReading.deleteMany({
        where: { waterPointId: { in: createdWaterPointIds } },
      });
      await prisma.waterPoint.deleteMany({ where: { id: { in: createdWaterPointIds } } });
      await prisma.notification.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.alert.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.customer.deleteMany({ where: { id: customerId } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  let waterPointId: string;

  it("1. crée un point d'eau (index initial 120, tarif 2500 FCFA/m³) → code auto EAU-NNN", async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/water-points')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Point Eau Test 1',
        location: 'Village Test',
        meterReference: 'CPT-TEST-01',
        initialIndex: 120,
        tariffFcfaPerM3: 2500,
        responsibleId: ownerUserId,
      })
      .expect(201);
    const waterPoint = body<WaterPointResponseBody>(res);
    expect(waterPoint.code).toMatch(/^EAU-\d{3}$/);
    expect(Number(waterPoint.initialIndex)).toBe(120);
    waterPointId = waterPoint.id;
    createdWaterPointIds.push(waterPointId);
  });

  it('2. saisit le relevé J1 (§16-E) : index 120 -> 128, 8 m³, encaissement exact sans écart', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/water-points/${waterPointId}/readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: DAY1.toISOString(), indexMatin: 120, indexSoir: 128, cashAmountFcfa: 20_000 })
      .expect(201);
    const reading = body<WaterReadingResponseBody>(res);
    expect(Number(reading.consumptionM3)).toBe(8);
    expect(reading.theoreticalAmountFcfa).toBe(20_000);
    expect(reading.varianceFcfa).toBe(0);
    // Aucune vente encore enregistrée pour ce point/jour.
    expect(reading.salesCashGapFcfa).toBe(20_000);
  });

  it('3. vend en comptoir (sans client) puis à un client identifié, productType=EAU', async () => {
    const comptoirRes = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productType: 'EAU',
        waterPointId,
        date: DAY1.toISOString(),
        saleMode: 'UNITE',
        quantity: 5,
        unitPriceFcfa: 500,
        status: 'CONFIRMEE',
      })
      .expect(201);
    const comptoirSale = body<SaleResponseBody>(comptoirRes);
    expect(comptoirSale.customerId).toBeNull();
    expect(comptoirSale.netAmountFcfa).toBe(2_500);

    const clientRes = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productType: 'EAU',
        waterPointId,
        date: DAY1.toISOString(),
        customerId,
        saleMode: 'UNITE',
        quantity: 10,
        unitPriceFcfa: 500,
        status: 'CONFIRMEE',
      })
      .expect(201);
    const clientSale = body<SaleResponseBody>(clientRes);
    expect(clientSale.customerId).toBe(customerId);
    expect(clientSale.netAmountFcfa).toBe(5_000);
  });

  it('4. refuse une vente EAU sans waterPointId (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productType: 'EAU',
        date: DAY1.toISOString(),
        saleMode: 'UNITE',
        quantity: 1,
        unitPriceFcfa: 500,
        status: 'CONFIRMEE',
      })
      .expect(400);
  });

  it('5. le rapprochement informatif reflète les 2 ventes du jour (20 000 - 7 500 = 12 500)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/water-points/${waterPointId}/readings/${DAY1.toISOString()}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<WaterReadingResponseBody>(res).salesCashGapFcfa).toBe(12_500);
  });

  it('6. refuse un relevé avec index soir < index matin sans motif (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/water-points/${waterPointId}/readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: DAY2.toISOString(), indexMatin: 128, indexSoir: 100, cashAmountFcfa: 0 })
      .expect(400);
  });

  it('7. refuse le même relevé avec un motif mais sans consumptionM3 (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/water-points/${waterPointId}/readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        date: DAY2.toISOString(),
        indexMatin: 128,
        indexSoir: 100,
        indexAnomalyReason: 'Compteur remplacé',
        cashAmountFcfa: 12_500,
      })
      .expect(400);
  });

  it('8. accepte le relevé J2 avec motif + consumptionM3 en override (compteur remplacé)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/water-points/${waterPointId}/readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        date: DAY2.toISOString(),
        indexMatin: 128,
        indexSoir: 100,
        indexAnomalyReason: 'Compteur remplacé',
        consumptionM3: 5,
        cashAmountFcfa: 12_500,
      })
      .expect(201);
    const reading = body<WaterReadingResponseBody>(res);
    expect(Number(reading.consumptionM3)).toBe(5);
    expect(reading.theoreticalAmountFcfa).toBe(12_500);
    expect(reading.varianceFcfa).toBe(0);
  });

  it('9. refuse un relevé dont l’index matin ne correspond pas au dernier index validé, sans motif (409)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/water-points/${waterPointId}/readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: DAY3.toISOString(), indexMatin: 999, indexSoir: 1010, cashAmountFcfa: 0 })
      .expect(409);
  });

  it('10. refuse un écart théorique/encaissé non justifié (400), accepte avec remarks', async () => {
    // Index matin cohérent (= dernier index soir validé, 100) : 10 m³, 25 000 FCFA théoriques.
    await request(app.getHttpServer())
      .post(`/api/v1/water-points/${waterPointId}/readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: DAY3.toISOString(), indexMatin: 100, indexSoir: 110, cashAmountFcfa: 20_000 })
      .expect(400);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/water-points/${waterPointId}/readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        date: DAY3.toISOString(),
        indexMatin: 100,
        indexSoir: 110,
        cashAmountFcfa: 20_000,
        remarks: 'Casse de récipients non facturée, écart justifié',
      })
      .expect(201);
    const reading = body<WaterReadingResponseBody>(res);
    expect(reading.theoreticalAmountFcfa).toBe(25_000);
    expect(reading.varianceFcfa).toBe(-5_000);
  });

  it("11. verrouille l'index initial dès qu'un relevé existe (409)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/water-points/${waterPointId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ initialIndex: 50 })
      .expect(409);
    expect(body<ErrorResponseBody>(res).message).toContain('index initial');
  });

  it("12. refuse la suppression d'un point d'eau avec des relevés/ventes liés (409)", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/water-points/${waterPointId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);
  });

  it('13. le KPI agrégé reflète les 3 relevés (8 + 5 + 10 = 23 m³) et les créances du client identifié', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/water-points/${waterPointId}/kpi?from=${DAY1.toISOString()}&to=${DAY3.toISOString()}`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const kpi = body<WaterPointKpiResponseBody>(res);
    expect(kpi.totalConsumptionM3).toBe(23);
    // 20000 (J1) + 12500 (J2) + 25000 (J3) = 57500
    expect(kpi.totalTheoreticalAmountFcfa).toBe(57_500);
    // 20000 (J1) + 12500 (J2) + 20000 (J3) = 52500
    expect(kpi.totalCashAmountFcfa).toBe(52_500);
    expect(kpi.totalVarianceFcfa).toBe(-5_000);
    // Vente client identifié (5000 FCFA, CONFIRMEE, jamais payée) -> créance intégrale.
    expect(kpi.receivablesFcfa).toBe(5_000);
    // 23 m³ / 3 relevés.
    expect(kpi.averageConsumptionM3).toBeCloseTo(7.6667, 3);
    // 3 relevés sur une période de 3 jours (J1-J3 inclus).
    expect(kpi.availabilityRatePercent).toBe(100);
    // Phase 7 — aucune Expense rattachée à ce point d'eau dans ce
    // scénario : la marge est donc égale au CA théorique (pas à
    // l'encaissé, qui mélange comptoir/crédit/écarts de caisse, voir
    // WaterPointsService.getKpiSummary).
    expect(kpi.totalExpensesFcfa).toBe(0);
    expect(kpi.grossMarginFcfa).toBe(57_500);
  });

  it("14. le cron d'alertes eau s'exécute sans erreur", async () => {
    await expect(waterCronService.runDailySweep()).resolves.toBeUndefined();
  });

  describe('Isolation farmId et RBAC', () => {
    let readerBToken: string;

    beforeAll(async () => {
      const { id, email } = await createActiveUser(
        prisma,
        passwordService,
        farmB.id,
        lecteurRoleId,
        'ReaderBWaterTest!2026',
      );
      createdUserIds.push(id);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email, password: 'ReaderBWaterTest!2026' })
        .expect(200);
      readerBToken = body<LoginResponseBody>(res).accessToken!;
    });

    it("GET /water-points/:id d'un point de la ferme A avec un token de la ferme B → 404 générique", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/water-points/${waterPointId}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('GET .../readings/:date avec un token de la ferme B → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/water-points/${waterPointId}/readings/${DAY1.toISOString()}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it("un Lecteur (lecture seule) ne peut pas créer de point d'eau — 403", async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/water-points')
        .set('Authorization', `Bearer ${readerBToken}`)
        .send({
          name: 'Point Interdit',
          initialIndex: 0,
          tariffFcfaPerM3: 1000,
          responsibleId: ownerUserId,
        })
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });

    it('un Lecteur ne peut pas saisir de relevé — 403', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/water-points/${waterPointId}/readings`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .send({ date: DAY3.toISOString(), indexMatin: 110, indexSoir: 115, cashAmountFcfa: 0 })
        .expect(403);
    });
  });
});
