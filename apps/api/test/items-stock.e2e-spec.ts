import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { ItemsAlertsCronService } from '../src/modules/items/items-alerts.cron';
import { PurchaseOrdersAlertsCronService } from '../src/modules/purchase-orders/purchase-orders-alerts.cron';
import {
  body,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Scénario d'acceptation Phase 7 §16-F, rejoué de bout en bout contre une
 * vraie base MySQL (pas de mocks) : catalogue d'articles → commande
 * fournisseur → réception partielle puis complète (écart, CUMP, statut
 * dérivé) → distribution automatique à une bande (mouvement de stock +
 * charge valorisée, rentabilité en cours d'élevage) → paiement fournisseur
 * (plafond §15) → mouvement manuel (ajustement justifié, réservation des
 * motifs automatiques) → garde-fou de suppression → isolation farmId →
 * RBAC → concurrence (verrouillage FOR UPDATE, seul mécanisme de
 * concurrence réel du projet, voir DETTE_TECHNIQUE.md).
 */
jest.setTimeout(30_000);

interface ItemResponseBody {
  id: string;
  currentStock: string;
  averageUnitCostFcfa: number;
  status: 'VERT' | 'ORANGE' | 'ROUGE';
}
interface PurchaseOrderItemResponseBody {
  id: string;
  itemId: string;
  receivedQuantity: number;
  discrepancy: number;
}
interface PurchaseOrderResponseBody {
  id: string;
  code: string;
  status: string;
  totalAmountFcfa: number;
  paidAmountFcfa: number;
  balanceFcfa: number;
  items: PurchaseOrderItemResponseBody[];
}
interface BatchResponseBody {
  id: string;
  code: string;
}
interface DailyRecordResponseBody {
  feedItemId: string | null;
  feedDistributedKg: string | null;
}
interface ProfitabilitySummaryBody {
  finances: { totalExpensesFcfa: number };
}
interface StockMovementResponseBody {
  id: string;
  type: string;
  reason: string;
  quantity: string;
}
describe('Stocks, achats et finances — cycle complet (e2e, scénario §16-F)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let itemsAlertsCron: ItemsAlertsCronService;
  let purchaseOrdersAlertsCron: PurchaseOrdersAlertsCronService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;
  let lecteurRoleId: string;
  let magasinierRoleId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let buildingId: string;
  let supplierId: string;

  const createdUserIds: string[] = [];
  const createdItemIds: string[] = [];
  const createdOrderIds: string[] = [];
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
    itemsAlertsCron = app.get(ItemsAlertsCronService);
    purchaseOrdersAlertsCron = app.get(PurchaseOrdersAlertsCronService);

    const roles = await prisma.role.findMany({ where: { farmId: null } });
    const proprietaireRole = roles.find((r) => r.name === 'Propriétaire / Administrateur');
    const lecteurRole = roles.find((r) => r.name === 'Lecteur / Lecture seule');
    const magasinierRole = roles.find((r) => r.name === 'Magasinier / Responsable stocks');
    if (!proprietaireRole || !lecteurRole || !magasinierRole) {
      throw new Error(
        'Référentiel de rôles Phase 1 introuvable — lancer `npm run db:seed` avant les tests.',
      );
    }
    proprietaireRoleId = proprietaireRole.id;
    lecteurRoleId = lecteurRole.id;
    magasinierRoleId = magasinierRole.id;

    farmA = await prisma.farm.create({ data: { name: `Ferme Test A (stocks e2e ${Date.now()})` } });
    farmB = await prisma.farm.create({ data: { name: `Ferme Test B (stocks e2e ${Date.now()})` } });

    const { id: userId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      proprietaireRoleId,
      'OwnerStocksTest!2026',
    );
    ownerUserId = userId;
    createdUserIds.push(userId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'OwnerStocksTest!2026' })
      .expect(200);
    ownerToken = body<LoginResponseBody>(loginRes).accessToken!;

    const building = await prisma.building.create({
      data: {
        farmId: farmA.id,
        name: 'Poulailler Stocks Test',
        type: 'CHAIR',
        createdBy: ownerUserId,
      },
    });
    buildingId = building.id;

    const supplier = await prisma.supplier.create({
      data: {
        farmId: farmA.id,
        name: 'Fournisseur Aliment Test',
        category: 'aliment',
        createdBy: ownerUserId,
      },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    // Ordre sûr vis-à-vis des FK : paiements fournisseur -> réceptions ->
    // lignes/commandes -> dépenses/journées/bandes -> mouvements -> articles
    // -> références -> utilisateurs -> fermes.
    await prisma.supplierPayment.deleteMany({
      where: { purchaseOrderId: { in: createdOrderIds } },
    });
    await prisma.goodsReceiptItem.deleteMany({
      where: { purchaseOrderItem: { purchaseOrderId: { in: createdOrderIds } } },
    });
    await prisma.goodsReceipt.deleteMany({ where: { purchaseOrderId: { in: createdOrderIds } } });
    await prisma.purchaseOrderItem.deleteMany({
      where: { purchaseOrderId: { in: createdOrderIds } },
    });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.expense.deleteMany({ where: { batchId: { in: createdBatchIds } } });
    await prisma.broilerDailyRecord.deleteMany({ where: { batchId: { in: createdBatchIds } } });
    await prisma.broilerBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
    await prisma.stockMovement.deleteMany({ where: { itemId: { in: createdItemIds } } });
    await prisma.item.deleteMany({ where: { id: { in: createdItemIds } } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.building.deleteMany({ where: { id: buildingId } });
    // Les crons d'alerte déclenchent des notifications sur IMPORTANT/CRITIQUE
    // — à nettoyer avant les alertes elles-mêmes (Notification.alertId) et
    // avant les utilisateurs (Notification.userId).
    await prisma.notification.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    await prisma.alert.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    await app.close();
  });

  let itemId: string;
  let purchaseOrderId: string;
  let batchId: string;

  it('1. crée un article (Aliment démarrage, seuil 100 kg)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Aliment démarrage', category: 'Alimentation', unit: 'kg', minThreshold: 100 })
      .expect(201);
    const item = body<ItemResponseBody>(res);
    expect(Number(item.currentStock)).toBe(0);
    expect(item.status).toBe('ROUGE');
    itemId = item.id;
    createdItemIds.push(itemId);
  });

  it('2. crée une commande fournisseur de 500 kg à 400 FCFA/kg → code auto ACH-AAAA-NNN, BROUILLON', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        supplierId,
        date: new Date().toISOString(),
        items: [{ itemId, orderedQuantity: 500, unitPriceFcfa: 400 }],
      })
      .expect(201);
    const order = body<PurchaseOrderResponseBody>(res);
    expect(order.code).toMatch(/^ACH-\d{4}-\d{3}$/);
    expect(order.status).toBe('BROUILLON');
    expect(order.totalAmountFcfa).toBe(200_000);
    purchaseOrderId = order.id;
    createdOrderIds.push(purchaseOrderId);
  });

  it('3. passe la commande en COMMANDE', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/purchase-orders/${purchaseOrderId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'COMMANDE' })
      .expect(200);
    expect(body<PurchaseOrderResponseBody>(res).status).toBe('COMMANDE');
  });

  it('4. réceptionne partiellement 300 kg → stock +300, écart -200, statut PARTIELLEMENT_RECU', async () => {
    const orderRes = await request(app.getHttpServer())
      .get(`/api/v1/purchase-orders/${purchaseOrderId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const purchaseOrderItemId = body<PurchaseOrderResponseBody>(orderRes).items[0]!.id;

    await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${purchaseOrderId}/receipts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        date: new Date().toISOString(),
        items: [{ purchaseOrderItemId, receivedQuantity: 300 }],
      })
      .expect(201);

    const itemRes = await request(app.getHttpServer())
      .get(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const item = body<ItemResponseBody>(itemRes);
    expect(Number(item.currentStock)).toBe(300);
    expect(item.averageUnitCostFcfa).toBe(400);

    const orderAfterRes = await request(app.getHttpServer())
      .get(`/api/v1/purchase-orders/${purchaseOrderId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const orderAfter = body<PurchaseOrderResponseBody>(orderAfterRes);
    expect(orderAfter.status).toBe('PARTIELLEMENT_RECU');
    expect(orderAfter.items[0]!.receivedQuantity).toBe(300);
    expect(orderAfter.items[0]!.discrepancy).toBe(-200);
  });

  it('5. réceptionne le solde de 200 kg → stock 500, écart 0, statut RECU, CUMP inchangé (même coût)', async () => {
    const orderRes = await request(app.getHttpServer())
      .get(`/api/v1/purchase-orders/${purchaseOrderId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const purchaseOrderItemId = body<PurchaseOrderResponseBody>(orderRes).items[0]!.id;

    await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${purchaseOrderId}/receipts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        date: new Date().toISOString(),
        items: [{ purchaseOrderItemId, receivedQuantity: 200 }],
      })
      .expect(201);

    const itemRes = await request(app.getHttpServer())
      .get(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const item = body<ItemResponseBody>(itemRes);
    expect(Number(item.currentStock)).toBe(500);
    expect(item.averageUnitCostFcfa).toBe(400);
    expect(item.status).toBe('VERT');

    const orderAfterRes = await request(app.getHttpServer())
      .get(`/api/v1/purchase-orders/${purchaseOrderId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const orderAfter = body<PurchaseOrderResponseBody>(orderAfterRes);
    expect(orderAfter.status).toBe('RECU');
    expect(orderAfter.items[0]!.discrepancy).toBe(0);
  });

  it('6. crée une bande de poulets de chair (100 sujets)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/broiler-batches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        arrivalDate: new Date().toISOString(),
        origin: 'ACHAT',
        supplierId,
        orderedQuantity: 100,
        receivedQuantity: 100,
        deadOnArrivalQuantity: 0,
        unitPriceFcfa: 500,
        buildingId,
        primaryManagerId: ownerUserId,
      })
      .expect(201);
    batchId = body<BatchResponseBody>(res).id;
    createdBatchIds.push(batchId);
  });

  it('7. distribue 50 kg d’aliment (feedItemId) → sortie automatique, charge valorisée, rentabilité mise à jour', async () => {
    const beforeRes = await request(app.getHttpServer())
      .get(`/api/v1/broiler-batches/${batchId}/profitability`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const expensesBefore = body<ProfitabilitySummaryBody>(beforeRes).finances.totalExpensesFcfa;

    const recordRes = await request(app.getHttpServer())
      .patch(`/api/v1/broiler-batches/${batchId}/daily-records/1`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ feedItemId: itemId, feedDistributedKg: 50 })
      .expect(200);
    const record = body<DailyRecordResponseBody>(recordRes);
    expect(record.feedItemId).toBe(itemId);
    expect(Number(record.feedDistributedKg)).toBe(50);

    const itemRes = await request(app.getHttpServer())
      .get(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    // 500 - 50 = 450 kg (jamais 500 : le mouvement s'applique bien).
    expect(Number(body<ItemResponseBody>(itemRes).currentStock)).toBe(450);

    const afterRes = await request(app.getHttpServer())
      .get(`/api/v1/broiler-batches/${batchId}/profitability`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const expensesAfter = body<ProfitabilitySummaryBody>(afterRes).finances.totalExpensesFcfa;
    // 50 kg x 400 FCFA/kg (CUMP courant) = 20 000 FCFA de charge automatique.
    expect(expensesAfter - expensesBefore).toBe(20_000);
  });

  it('8. paiement fournisseur partiel (150 000 FCFA) → solde 50 000 FCFA', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/supplier-payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        purchaseOrderId,
        date: new Date().toISOString(),
        method: 'Virement',
        amountFcfa: 150_000,
      })
      .expect(201);

    const orderRes = await request(app.getHttpServer())
      .get(`/api/v1/purchase-orders/${purchaseOrderId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const order = body<PurchaseOrderResponseBody>(orderRes);
    expect(order.paidAmountFcfa).toBe(150_000);
    expect(order.balanceFcfa).toBe(50_000);
  });

  it('9. refuse un paiement fournisseur dépassant le solde restant (§15, 409)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/supplier-payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        purchaseOrderId,
        date: new Date().toISOString(),
        method: 'Espèces',
        amountFcfa: 60_000,
      })
      .expect(409);
    expect(body<ErrorResponseBody>(res).message).toContain('solde restant');
  });

  it('10. refuse un mouvement manuel AJUSTEMENT sans justification (§15, 400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stock-movements')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        itemId,
        type: 'SORTIE',
        reason: 'AJUSTEMENT',
        quantity: 5,
        date: new Date().toISOString(),
      })
      .expect(400);
  });

  it('11. accepte l’ajustement d’inventaire avec justification → stock 445', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stock-movements')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        itemId,
        type: 'SORTIE',
        reason: 'AJUSTEMENT',
        quantity: 5,
        date: new Date().toISOString(),
        justification: 'Écart constaté à l’inventaire physique',
      })
      .expect(201);
    expect(Number(body<StockMovementResponseBody>(res).quantity)).toBe(5);

    const itemRes = await request(app.getHttpServer())
      .get(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Number(body<ItemResponseBody>(itemRes).currentStock)).toBe(445);
  });

  it('12. refuse un mouvement manuel de motif ACHAT (réservé au flux automatique de réception, 400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stock-movements')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        itemId,
        type: 'ENTREE',
        reason: 'ACHAT',
        quantity: 10,
        date: new Date().toISOString(),
        unitCostFcfa: 400,
      })
      .expect(400);
  });

  it('13. refuse la suppression d’un article avec des mouvements enregistrés (409)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);
  });

  describe('Isolation farmId et RBAC', () => {
    let readerBToken: string;
    let magasinierAToken: string;

    beforeAll(async () => {
      const reader = await createActiveUser(
        prisma,
        passwordService,
        farmB.id,
        lecteurRoleId,
        'ReaderBStocksTest!2026',
      );
      createdUserIds.push(reader.id);
      const readerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email: reader.email, password: 'ReaderBStocksTest!2026' })
        .expect(200);
      readerBToken = body<LoginResponseBody>(readerRes).accessToken!;

      const magasinier = await createActiveUser(
        prisma,
        passwordService,
        farmA.id,
        magasinierRoleId,
        'MagasinierATest!2026',
      );
      createdUserIds.push(magasinier.id);
      const magasinierRes = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email: magasinier.email, password: 'MagasinierATest!2026' })
        .expect(200);
      magasinierAToken = body<LoginResponseBody>(magasinierRes).accessToken!;
    });

    it("GET /items/:id d'un article de la ferme A avec un token de la ferme B → 404 générique", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('un Lecteur (lecture seule) ne peut pas créer d’article — 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${readerBToken}`)
        .send({ name: 'Interdit', category: 'Test', unit: 'kg' })
        .expect(403);
    });

    it('un Magasinier peut créer un article et un mouvement de stock (mandat stocks complet)', async () => {
      const itemRes = await request(app.getHttpServer())
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${magasinierAToken}`)
        .send({ name: 'Article Magasinier', category: 'Test', unit: 'unité' })
        .expect(201);
      const magasinierItemId = body<ItemResponseBody>(itemRes).id;
      createdItemIds.push(magasinierItemId);

      await request(app.getHttpServer())
        .post('/api/v1/stock-movements')
        .set('Authorization', `Bearer ${magasinierAToken}`)
        .send({
          itemId: magasinierItemId,
          type: 'ENTREE',
          reason: 'PRODUCTION_INTERNE',
          quantity: 10,
          date: new Date().toISOString(),
          unitCostFcfa: 100,
        })
        .expect(201);
    });

    it('un Magasinier ne peut PAS créer de commande fournisseur (mandat stocks, pas achats) — 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${magasinierAToken}`)
        .send({
          supplierId,
          date: new Date().toISOString(),
          items: [{ itemId, orderedQuantity: 1, unitPriceFcfa: 100 }],
        })
        .expect(403);
    });
  });

  /**
   * Test de concurrence dédié — obligatoire pour cette phase (contrairement
   * à la Phase 6/eau, structurellement sans disponibilité à vérifier) :
   * Item.currentStock est un compteur PERSISTÉ partagé, potentiellement
   * écrit par plusieurs flux en parallèle (Broiler/Layer/HealthEvent/
   * GoodsReceipt). Vérifie le verrouillage SELECT ... FOR UPDATE de
   * StockMovementsService.recordMovementInTransaction — même mécanisme et
   * même gabarit de test que la Phase 4 (voir "Concurrence FIFO" dans
   * layer-batches.e2e-spec.ts), jamais isolationLevel: Serializable (bug
   * amont documenté dans DETTE_TECHNIQUE.md).
   */
  describe('Concurrence — verrouillage FOR UPDATE (StockMovementsService)', () => {
    let concurrencyItemId: string;

    beforeAll(async () => {
      const itemRes = await request(app.getHttpServer())
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Article Concurrence', category: 'Test', unit: 'unité' })
        .expect(201);
      concurrencyItemId = body<ItemResponseBody>(itemRes).id;
      createdItemIds.push(concurrencyItemId);

      // 100 unités en stock — deux sorties de 70 sont chacune
      // individuellement valides, mais 70 + 70 = 140 > 100.
      await request(app.getHttpServer())
        .post('/api/v1/stock-movements')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          itemId: concurrencyItemId,
          type: 'ENTREE',
          reason: 'PRODUCTION_INTERNE',
          quantity: 100,
          date: new Date().toISOString(),
          unitCostFcfa: 1_000,
        })
        .expect(201);
    });

    it('exactement une des deux sorties simultanées réussit, l’autre est rejetée proprement (409), stock final cohérent', async () => {
      const sendSortie = () =>
        request(app.getHttpServer())
          .post('/api/v1/stock-movements')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            itemId: concurrencyItemId,
            type: 'SORTIE',
            reason: 'PERTE',
            quantity: 70,
            date: new Date().toISOString(),
          });

      const [resA, resB] = await Promise.all([sendSortie(), sendSortie()]);
      const statuses = [resA.status, resB.status].sort();

      // Ni les deux ne réussissent (stock négatif), ni les deux n'échouent
      // (blocage indu) — exactement une des deux, et l'échec est un 409
      // métier propre (stock insuffisant), jamais un 500 non géré.
      expect(statuses).toEqual([201, 409]);

      const itemRes = await request(app.getHttpServer())
        .get(`/api/v1/items/${concurrencyItemId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      // Une seule sortie a pu être appliquée : 100 - 70 = 30 restants
      // (jamais 100 - 140 = -40, jamais un double décompte silencieux).
      expect(Number(body<ItemResponseBody>(itemRes).currentStock)).toBe(30);

      const movementsRes = await request(app.getHttpServer())
        .get(`/api/v1/stock-movements?itemId=${concurrencyItemId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const movements = body<StockMovementResponseBody[]>(movementsRes);
      const sorties = movements.filter((m) => m.type === 'SORTIE');
      expect(sorties).toHaveLength(1);
      expect(Number(sorties[0]!.quantity)).toBe(70);
    });
  });

  /**
   * Phase 8 — durcissement (bilan V1-V5 : aucune alerte stock/financière
   * n'existait, contrairement à tous les autres modules métier). Va
   * au-delà du niveau "s'exécute sans erreur" du reste du projet : vérifie
   * qu'une alerte est réellement créée avec le bon type/sévérité, pas
   * seulement l'absence d'exception — logique neuve, donc plus de valeur
   * qu'un simple smoke test.
   */
  describe('Alertes stock (ItemsAlertsCronService)', () => {
    let ruptureItemId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Article Rupture Test', category: 'Test', unit: 'unité', minThreshold: 10 })
        .expect(201);
      ruptureItemId = body<ItemResponseBody>(res).id;
      createdItemIds.push(ruptureItemId);
    });

    it('lève une alerte CRITIQUE (rupture, stock à 0) au premier balayage, jamais deux fois au second', async () => {
      await itemsAlertsCron.runDailySweep();

      const alertsAfterFirst = await prisma.alert.findMany({
        where: { entityType: 'item', entityId: ruptureItemId },
      });
      expect(alertsAfterFirst).toHaveLength(1);
      expect(alertsAfterFirst[0]!.type).toBe('item_stock_rouge');
      expect(alertsAfterFirst[0]!.severity).toBe('CRITIQUE');

      // Deuxième balayage : la même alerte d'état ne doit jamais être
      // recréée (idempotence par type+entityId, comme les autres crons).
      await itemsAlertsCron.runDailySweep();
      const alertsAfterSecond = await prisma.alert.findMany({
        where: { entityType: 'item', entityId: ruptureItemId },
      });
      expect(alertsAfterSecond).toHaveLength(1);
    });
  });

  describe('Alertes finance (PurchaseOrdersAlertsCronService)', () => {
    let overdueOrderId: string;

    beforeAll(async () => {
      const pastDueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          supplierId,
          date: pastDueDate.toISOString(),
          dueDate: pastDueDate.toISOString(),
          items: [{ itemId, orderedQuantity: 1, unitPriceFcfa: 1_000 }],
        })
        .expect(201);
      overdueOrderId = body<PurchaseOrderResponseBody>(res).id;
      createdOrderIds.push(overdueOrderId);
    });

    it('lève une alerte IMPORTANT (facture en retard, solde non nul) au premier balayage, jamais deux fois au second', async () => {
      await purchaseOrdersAlertsCron.runDailySweep();

      const alertsAfterFirst = await prisma.alert.findMany({
        where: { entityType: 'purchase_order', entityId: overdueOrderId },
      });
      expect(alertsAfterFirst).toHaveLength(1);
      expect(alertsAfterFirst[0]!.type).toBe('purchase_order_overdue');
      expect(alertsAfterFirst[0]!.severity).toBe('IMPORTANT');

      await purchaseOrdersAlertsCron.runDailySweep();
      const alertsAfterSecond = await prisma.alert.findMany({
        where: { entityType: 'purchase_order', entityId: overdueOrderId },
      });
      expect(alertsAfterSecond).toHaveLength(1);
    });
  });
});
