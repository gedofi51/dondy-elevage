import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { LayerAlertsCronService } from '../src/modules/layer-batches/layer-alerts.cron';
import {
  body,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Scénario d'acceptation V5 §16-B, rejoué de bout en bout contre une vraie
 * base MySQL (pas de mocks) : création de lot → 3 journées de ponte
 * (henCount suggéré/ajustement contrôlé) → génération automatique des
 * EggStockLot → vente traversant 2 lots (FIFO) → perte manuelle → 2e vente →
 * annulation (mouvement compensatoire) → clôture avec résumé de cohérence.
 *
 * §16-B ne donne qu'un chiffre ("1000 pondeuses, 950 œufs produits") sans
 * détailler pertes/vente partielle/stock restant sur plusieurs jours — les
 * valeurs ci-dessous sont une extension cohérente de ce point de départ
 * (950/1000 = 95,00 %, exactement le chiffre du cahier), pas une correction
 * d'une incohérence du cahier (contrairement au scénario Phase 3).
 */
jest.setTimeout(30_000);

const DAY0 = new Date('2026-08-01T00:00:00.000Z');
const DAY1 = new Date('2026-08-02T00:00:00.000Z');
const DAY2 = new Date('2026-08-03T00:00:00.000Z');

interface LayerBatchResponseBody {
  id: string;
  code: string;
  status: string;
  initialQuantity: number;
  currentHeadcount: number;
}
interface DailyRecordResponseBody {
  id: string;
  date: string;
  henCount: number;
  eggsLaid: number;
  eggsSellable: number;
  layingRatePercent: string | null;
}
interface EggStockLotResponseBody {
  id: string;
  dailyRecordId: string;
  quantityProduced: number;
  remaining: number;
}
interface SaleResponseBody {
  id: string;
  saleNumber: string;
  productType: string;
  status: string;
  quantity: number;
  netAmountFcfa: number;
}
interface EggStockMovementResponseBody {
  id: string;
  type: string;
  quantity: number;
  lotId: string;
}
interface ClosureResponseBody {
  batch: LayerBatchResponseBody;
  summary: {
    production: {
      cumulativeEggsLaid: number;
      cumulativeEggsSellable: number;
      cumulativeEggsSold: number;
      averageLayingRatePercent: number;
    };
    stock: { remainingEggStock: number };
    finances: {
      totalExpensesFcfa: number;
      revenueFcfa: number;
      grossMarginFcfa: number;
      costPerEggFcfa: number;
    };
    coherence: {
      lastRecordedHenCount: number | null;
      computedHeadcount: number;
      isCoherent: boolean;
    };
  };
}

describe('Layer batches — cycle de vie complet (e2e, scénario §16-B)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let layerCronService: LayerAlertsCronService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;
  let lecteurRoleId: string;
  let buildingId: string;
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
    layerCronService = app.get(LayerAlertsCronService);

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

    farmA = await prisma.farm.create({ data: { name: `Ferme Test A (layer e2e ${Date.now()})` } });
    farmB = await prisma.farm.create({ data: { name: `Ferme Test B (layer e2e ${Date.now()})` } });

    const { id: userId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      proprietaireRoleId,
      'OwnerLayerTest!2026',
    );
    ownerUserId = userId;
    createdUserIds.push(userId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'OwnerLayerTest!2026' })
      .expect(200);
    ownerToken = body<LoginResponseBody>(loginRes).accessToken!;

    const building = await prisma.building.create({
      data: {
        farmId: farmA.id,
        name: 'Poulailler Pondeuses Test',
        type: 'PONTE',
        createdBy: ownerUserId,
      },
    });
    buildingId = building.id;

    const customer = await prisma.customer.create({
      data: {
        farmId: farmA.id,
        code: 'CLI-TEST02',
        name: 'Grossiste Œufs Test',
        type: 'REVENDEUR',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    // Ordre sûr vis-à-vis des FK : mouvements de stock -> paiements -> ventes
    // -> dépenses -> santé/journalier -> lots d'œufs -> lots pondeuses ->
    // références -> notifications -> utilisateurs -> fermes.
    const sales = await prisma.sale.findMany({ where: { layerBatchId: { in: createdBatchIds } } });
    await prisma.eggStockMovement.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    await prisma.payment.deleteMany({ where: { saleId: { in: sales.map((s) => s.id) } } });
    await prisma.sale.deleteMany({ where: { layerBatchId: { in: createdBatchIds } } });
    await prisma.expense.deleteMany({ where: { layerBatchId: { in: createdBatchIds } } });
    await prisma.layerHealthEvent.deleteMany({ where: { batchId: { in: createdBatchIds } } });
    await prisma.eggStockLot.deleteMany({ where: { batchId: { in: createdBatchIds } } });
    await prisma.layerDailyRecord.deleteMany({ where: { batchId: { in: createdBatchIds } } });
    await prisma.notification.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    // farmId (pas entityId: createdBatchIds) : le cron d'alertes pondeuses
    // rattache aussi des alertes de vieillissement à entityType='egg_stock_lot'
    // (entityId = id du LOT, pas du batch) — un filtre sur entityId manquerait
    // ces lignes et bloquerait ensuite farm.deleteMany (FK).
    await prisma.alert.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    await prisma.layerBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.building.deleteMany({ where: { id: buildingId } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    await app.close();
  });

  let batchId: string;
  let lot1Id: string;
  let lot2Id: string;
  let lot3Id: string;
  let sale2Id: string;

  it('1. crée un lot de 1000 pondeuses → code auto PON-AAAA-NNN, effectif initial 1000', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/layer-batches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        entryDate: DAY0.toISOString(),
        strain: 'ISA Brown',
        initialQuantity: 1000,
        ageAtEntryWeeks: 18,
        buildingId,
        primaryManagerId: ownerUserId,
      })
      .expect(201);
    const batch = body<LayerBatchResponseBody>(res);
    expect(batch.code).toMatch(/^PON-\d{4}-\d{3}$/);
    expect(batch.initialQuantity).toBe(1000);
    expect(batch.currentHeadcount).toBe(1000);
    batchId = batch.id;
    createdBatchIds.push(batchId);
  });

  it('2. saisit J (D0) : 950 pondus, 20 cassés, 10 rejetés, 2 morts → 920 commercialisables, taux de ponte 95,00 % (§16-B)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/layer-batches/${batchId}/daily-records`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        date: DAY0.toISOString(),
        eggsLaid: 950,
        eggsBroken: 20,
        eggsRejected: 10,
        mortalityQuantity: 2,
      })
      .expect(201);
    const record = body<DailyRecordResponseBody>(res);
    expect(record.henCount).toBe(1000); // pas de journée précédente -> suggestion = effectif initial
    expect(record.eggsSellable).toBe(920);
    expect(Number(record.layingRatePercent)).toBeCloseTo(95, 2);

    const lotsRes = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/lots?batchId=${batchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const lots = body<EggStockLotResponseBody[]>(lotsRes);
    expect(lots).toHaveLength(1);
    expect(lots[0]!.quantityProduced).toBe(920);
    expect(lots[0]!.remaining).toBe(920);
    lot1Id = lots[0]!.id;
  });

  it('3. saisit D1 : henCount suggéré à 998 (1000 - 2 morts de la veille), 930 pondus → 910 commercialisables', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/layer-batches/${batchId}/daily-records`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        date: DAY1.toISOString(),
        eggsLaid: 930,
        eggsBroken: 15,
        eggsRejected: 5,
        mortalityQuantity: 2,
      })
      .expect(201);
    const record = body<DailyRecordResponseBody>(res);
    expect(record.henCount).toBe(998);
    expect(record.eggsSellable).toBe(910);

    const lotsRes = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/lots?batchId=${batchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const lots = body<EggStockLotResponseBody[]>(lotsRes);
    expect(lots).toHaveLength(2);
    lot2Id = lots.find((l) => l.dailyRecordId !== undefined && l.quantityProduced === 910)!.id;
  });

  it('4. vend 1500 œufs → FIFO consomme le lot D0 (920, épuisé) puis 580 du lot D1', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productType: 'OEUFS',
        layerBatchId: batchId,
        date: DAY1.toISOString(),
        customerId,
        saleMode: 'UNITE',
        quantity: 1500,
        unitPriceFcfa: 100,
        status: 'CONFIRMEE',
      })
      .expect(201);
    const sale = body<SaleResponseBody>(res);
    expect(sale.netAmountFcfa).toBe(150_000);

    const lot1Res = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/lots/${lot1Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<EggStockLotResponseBody>(lot1Res).remaining).toBe(0);

    const lot2Res = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/lots/${lot2Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<EggStockLotResponseBody>(lot2Res).remaining).toBe(330);

    const movementsRes = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/movements?lotId=${lot1Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const movements = body<EggStockMovementResponseBody[]>(movementsRes);
    expect(movements).toEqual([expect.objectContaining({ type: 'SORTIE_VENTE', quantity: 920 })]);
  });

  it('5. enregistre une casse manuelle de 10 œufs sur le lot D1 → stock restant 320', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/egg-stock/movements')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ lotId: lot2Id, type: 'PERTE_CASSE', quantity: 10, date: DAY2.toISOString() })
      .expect(201);

    const lot2Res = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/lots/${lot2Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<EggStockLotResponseBody>(lot2Res).remaining).toBe(320);
  });

  it('6. refuse une casse manuelle supérieure au stock restant du lot (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/egg-stock/movements')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ lotId: lot2Id, type: 'PERTE_CASSE', quantity: 10_000, date: DAY2.toISOString() })
      .expect(409);
  });

  it('7. saisit D2 : henCount suggéré à 996, 925 pondus → 910 commercialisables (lot D2)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/layer-batches/${batchId}/daily-records`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: DAY2.toISOString(), eggsLaid: 925, eggsBroken: 10, eggsRejected: 5 })
      .expect(201);
    const record = body<DailyRecordResponseBody>(res);
    expect(record.henCount).toBe(996);
    expect(record.eggsSellable).toBe(910);

    const lotsRes = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/lots?batchId=${batchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const lots = body<EggStockLotResponseBody[]>(lotsRes);
    expect(lots).toHaveLength(3);
    lot3Id = lots.find((l) => l.id !== lot1Id && l.id !== lot2Id)!.id;
  });

  it('8. vend 300 œufs → consommés depuis le lot D1 (320 restants après la casse du test 5, le plus ancien encore actif — pas de saut vers le lot D2 tout juste créé)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productType: 'OEUFS',
        layerBatchId: batchId,
        date: DAY2.toISOString(),
        customerId,
        saleMode: 'UNITE',
        quantity: 300,
        unitPriceFcfa: 110,
        status: 'CONFIRMEE',
      })
      .expect(201);
    const sale = body<SaleResponseBody>(res);
    expect(sale.netAmountFcfa).toBe(33_000);
    sale2Id = sale.id;

    // Lot D1 avait 320 restants (910 - 580 vendus au test 4 - 10 cassés au
    // test 5) — le plus ancien lot encore actif, donc le FIFO y puise en
    // priorité malgré la présence du lot D2 (910, intact) plus récent.
    const lot2Res = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/lots/${lot2Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<EggStockLotResponseBody>(lot2Res).remaining).toBe(20);

    const lot3Res = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/lots/${lot3Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<EggStockLotResponseBody>(lot3Res).remaining).toBe(910);
  });

  it('9. refuse une vente supérieure au stock total disponible (930) — 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productType: 'OEUFS',
        layerBatchId: batchId,
        date: DAY2.toISOString(),
        customerId,
        saleMode: 'UNITE',
        quantity: 1000,
        unitPriceFcfa: 100,
        status: 'CONFIRMEE',
      })
      .expect(409);
  });

  it('10. annule la vente 2 → mouvement ENTREE_ANNULATION compensatoire, SORTIE_VENTE d’origine conservé, stock restauré à 320 sur le lot D1', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/sales/${sale2Id}/annuler`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    const lot2Res = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/lots/${lot2Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<EggStockLotResponseBody>(lot2Res).remaining).toBe(320);

    const movementsRes = await request(app.getHttpServer())
      .get(`/api/v1/egg-stock/movements?lotId=${lot2Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const movements = body<EggStockMovementResponseBody[]>(movementsRes);
    expect(movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'SORTIE_VENTE', quantity: 300 }),
        expect.objectContaining({ type: 'ENTREE_ANNULATION', quantity: 300 }),
      ]),
    );
  });

  it('11. enregistre les dépenses d’aliment des 3 journées (143 000 FCFA cumulés)', async () => {
    for (const [date, amountFcfa] of [
      [DAY0, 50_000],
      [DAY1, 48_000],
      [DAY2, 45_000],
    ] as const) {
      await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ layerBatchId: batchId, date: date.toISOString(), category: 'aliments', amountFcfa })
        .expect(201);
    }
  });

  it('12. crée un événement sanitaire (vaccination) rattaché au lot', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/layer-batches/${batchId}/health-events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: DAY2.toISOString(), type: 'VACCINATION', status: 'REALISE' })
      .expect(201);
    expect(body<{ type: string }>(res).type).toBe('VACCINATION');
  });

  it('13. le cron d’alertes pondeuses s’exécute sans erreur sur un lot actif', async () => {
    await expect(layerCronService.runDailySweep()).resolves.toBeUndefined();
  });

  it('13bis. GET .../profitability est consultable sur un lot ACTIF (pas encore clôturé, Phase 7) — mêmes chiffres que la clôture ci-dessous', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/layer-batches/${batchId}/profitability`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const summary = body<ClosureResponseBody['summary']>(res);

    // Réutilise EXACTEMENT le même calcul que la clôture (test 14,
    // ci-dessous) — les chiffres doivent être identiques puisqu'aucune
    // saisie n'intervient entre les deux appels, la seule différence est
    // que le lot n'est pas encore CLOTURE.
    expect(summary.finances.totalExpensesFcfa).toBe(143_000);
    expect(summary.finances.revenueFcfa).toBe(150_000);
    expect(summary.finances.grossMarginFcfa).toBe(7_000);
    expect(summary.finances.costPerEggFcfa).toBeCloseTo(52.19, 1);
  });

  it('14. clôture le lot → résumé de cohérence complet (production/stock/finances/cohérence)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/layer-batches/${batchId}/cloturer`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const closure = body<ClosureResponseBody>(res);

    expect(closure.batch.status).toBe('CLOTURE');
    // 950 + 930 + 925
    expect(closure.summary.production.cumulativeEggsLaid).toBe(2805);
    // 920 + 910 + 910
    expect(closure.summary.production.cumulativeEggsSellable).toBe(2740);
    // Vente 1 (1500, CONFIRMEE) uniquement — vente 2 annulée exclue.
    expect(closure.summary.production.cumulativeEggsSold).toBe(1500);
    // 2805 / (1000+998+996) x 100
    expect(closure.summary.production.averageLayingRatePercent).toBeCloseTo(93.69, 1);
    // 0 (lot D0) + 320 (lot D1) + 910 (lot D2, vente 2 annulée)
    expect(closure.summary.stock.remainingEggStock).toBe(1230);
    expect(closure.summary.finances.totalExpensesFcfa).toBe(143_000);
    expect(closure.summary.finances.revenueFcfa).toBe(150_000);
    expect(closure.summary.finances.grossMarginFcfa).toBe(7_000);
    expect(closure.summary.finances.costPerEggFcfa).toBeCloseTo(52.19, 1);
    // Dernier henCount saisi (D2 = 996) vs effectif calculé
    // (1000 initial - 2 - 2 morts cumulées) = 996 : cohérent.
    expect(closure.summary.coherence.lastRecordedHenCount).toBe(996);
    expect(closure.summary.coherence.computedHeadcount).toBe(996);
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
        'ReaderBLayerTest!2026',
      );
      createdUserIds.push(id);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email, password: 'ReaderBLayerTest!2026' })
        .expect(200);
      readerBToken = body<LoginResponseBody>(res).accessToken!;
    });

    it('GET /layer-batches/:id d’un lot de la ferme A avec un token de la ferme B → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/layer-batches/${batchId}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('un Lecteur (lecture seule) ne peut pas créer de lot — 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/layer-batches')
        .set('Authorization', `Bearer ${readerBToken}`)
        .send({
          entryDate: DAY0.toISOString(),
          initialQuantity: 100,
          buildingId,
          primaryManagerId: ownerUserId,
        })
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });

    it('un Lecteur ne peut pas saisir de mouvement de stock manuel — 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/egg-stock/movements')
        .set('Authorization', `Bearer ${readerBToken}`)
        .send({ lotId: lot2Id, type: 'DON', quantity: 1, date: DAY2.toISOString() })
        .expect(403);
    });
  });

  /**
   * Test de concurrence explicitement demandé (ajout hors plan initial,
   * validé avant implémentation) : le mécanisme FIFO (transaction
   * Serializable + retry, voir EggStockService.consumeFifo /
   * SalesService.createEggSaleAndConsumeStock) est le premier de ce type
   * dans le projet, motivé par la prévention de la survente concurrente
   * (§15). Le scénario §16-B ci-dessus est séquentiel (vente 1 puis vente
   * 2) et ne teste donc jamais la concurrence réelle — ce bloc dédié
   * déclenche deux ventes simultanées sur un stock où chacune est valide
   * individuellement mais où leur somme dépasse le disponible.
   */
  describe('Concurrence FIFO — deux ventes simultanées dépassant le stock cumulé', () => {
    let concurrencyBatchId: string;

    beforeAll(async () => {
      const batchRes = await request(app.getHttpServer())
        .post('/api/v1/layer-batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entryDate: DAY0.toISOString(),
          initialQuantity: 500,
          buildingId,
          primaryManagerId: ownerUserId,
        })
        .expect(201);
      concurrencyBatchId = body<LayerBatchResponseBody>(batchRes).id;
      createdBatchIds.push(concurrencyBatchId);

      // 300 œufs commercialisables en stock — deux ventes de 200 sont
      // chacune individuellement valides, mais 200 + 200 = 400 > 300.
      await request(app.getHttpServer())
        .post(`/api/v1/layer-batches/${concurrencyBatchId}/daily-records`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ date: DAY0.toISOString(), eggsLaid: 300, eggsBroken: 0, eggsRejected: 0 })
        .expect(201);
    });

    it('exactement une des deux ventes concurrentes réussit, l’autre est rejetée proprement (409), stock final cohérent', async () => {
      const sendSale = () =>
        request(app.getHttpServer())
          .post('/api/v1/sales')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            productType: 'OEUFS',
            layerBatchId: concurrencyBatchId,
            date: DAY0.toISOString(),
            customerId,
            saleMode: 'UNITE',
            quantity: 200,
            unitPriceFcfa: 100,
            status: 'CONFIRMEE',
          });

      const [resA, resB] = await Promise.all([sendSale(), sendSale()]);
      const statuses = [resA.status, resB.status].sort();

      // Ni les deux ne réussissent (survente), ni les deux n'échouent
      // (perte de disponibilité légitime) — exactement une des deux, et
      // l'échec est un 409 métier propre, jamais un 500 non géré.
      expect(statuses).toEqual([201, 409]);

      const lotsRes = await request(app.getHttpServer())
        .get(`/api/v1/egg-stock/lots?batchId=${concurrencyBatchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const lots = body<EggStockLotResponseBody[]>(lotsRes);
      expect(lots).toHaveLength(1);
      // Une seule vente a pu consommer du stock : 300 - 200 = 100 restants
      // (jamais 300 - 400 = -100, jamais 300 - 200 - 200 en double compte).
      expect(lots[0]!.remaining).toBe(100);

      const movementsRes = await request(app.getHttpServer())
        .get(`/api/v1/egg-stock/movements?lotId=${lots[0]!.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const movements = body<EggStockMovementResponseBody[]>(movementsRes);
      const sortieMovements = movements.filter((m) => m.type === 'SORTIE_VENTE');
      expect(sortieMovements).toHaveLength(1);
      expect(sortieMovements[0]!.quantity).toBe(200);
    });
  });
});
