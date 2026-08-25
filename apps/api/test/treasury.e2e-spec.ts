import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import {
  body,
  closeAppSafely,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Phase 8 — durcissement (bilan V1-V5 : TreasuryService avait une
 * couverture de test nulle malgré l'implémentation complète en Phase 7).
 * Rejoue le scénario d'acceptation G du cahier V5 ("consolider ventes,
 * dépenses, paiements et calculer la marge par activité puis globale")
 * contre une vraie base MySQL — journal, créances/dettes, vue consolidée.
 */
jest.setTimeout(30_000);

const DAY1 = new Date('2026-08-01T00:00:00.000Z');

interface WaterPointResponseBody {
  id: string;
}
interface SaleResponseBody {
  id: string;
  netAmountFcfa: number;
}
interface PurchaseOrderResponseBody {
  id: string;
  totalAmountFcfa: number;
}
interface JournalEntryResponseBody {
  type: 'ENCAISSEMENT' | 'DECAISSEMENT';
  source: string;
  amountFcfa: number;
}
interface JournalResponseBody {
  entries: JournalEntryResponseBody[];
  totalEncaissementsFcfa: number;
  totalDecaissementsFcfa: number;
  netFcfa: number;
}
interface ReceivableResponseBody {
  customerId: string;
  balanceFcfa: number;
}
interface PayableResponseBody {
  supplierId: string;
  balanceFcfa: number;
}
interface SummaryResponseBody {
  revenueFcfa: number;
  totalExpensesFcfa: number;
  grossMarginFcfa: number;
  profitabilityRate: number;
  netTreasuryFcfa: number;
}

describe('Trésorerie — journal, créances/dettes, vue consolidée (e2e, scénario §16-G)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;
  let lecteurRoleId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let supplierId: string;
  let customerId: string;
  let itemId: string;
  let waterPointId: string;
  let purchaseOrderId: string;

  const createdUserIds: string[] = [];
  const createdItemIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdWaterPointIds: string[] = [];
  const createdSaleIds: string[] = [];

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
      data: { name: `Ferme Test A (treasury e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (treasury e2e ${Date.now()})` },
    });

    const { id: userId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      proprietaireRoleId,
      'OwnerTreasuryTest!2026',
    );
    ownerUserId = userId;
    createdUserIds.push(userId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'OwnerTreasuryTest!2026' })
      .expect(200);
    ownerToken = body<LoginResponseBody>(loginRes).accessToken!;

    const supplier = await prisma.supplier.create({
      data: { farmId: farmA.id, name: 'Fournisseur Trésorerie Test', category: 'aliment' },
    });
    supplierId = supplier.id;

    const customer = await prisma.customer.create({
      data: { farmId: farmA.id, code: 'CLI-TRES01', name: 'Client Trésorerie Test', type: 'AUTRE' },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    // closeAppSafely : si une des suppressions échoue (ex. FK sur une
    // entité créée par un test ajouté plus tard sans mettre à jour cet
    // ordre), l'app doit quand même se fermer — sinon la connexion Prisma
    // et les crons de cette instance restent actifs indéfiniment et
    // empêchent le worker Jest de sortir proprement (cf. incident CI Phase
    // 8 : une erreur non catchée ici a laissé un handle ouvert — même
    // classe de bug redécouverte indépendamment Phase 16
    // (assets.e2e-spec.ts), généralisée ici en helper partagé, voir
    // DETTE_TECHNIQUE.md).
    await closeAppSafely(app, async () => {
      // Ordre sûr vis-à-vis des FK : paiements -> ventes -> réceptions/lignes
      // -> commandes -> articles -> points d'eau -> références -> utilisateurs
      // -> fermes.
      await prisma.payment.deleteMany({ where: { saleId: { in: createdSaleIds } } });
      await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });
      await prisma.expense.deleteMany({ where: { farmId: farmA.id } });
      await prisma.supplierPayment.deleteMany({
        where: { purchaseOrderId: { in: createdOrderIds } },
      });
      await prisma.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: { in: createdOrderIds } },
      });
      await prisma.purchaseOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
      await prisma.item.deleteMany({ where: { id: { in: createdItemIds } } });
      await prisma.waterPoint.deleteMany({ where: { id: { in: createdWaterPointIds } } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
      await prisma.customer.deleteMany({ where: { id: customerId } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      // Diagnostic CI (commit 1acad95) : Alert orpheline pour farmA/farmB,
      // jamais tracée par ce fichier — aucun cron d'alerte n'est invoqué
      // ici, mais Notification.alertId dépend de Alert donc l'ordre reste
      // avant la ferme (avant les entités déjà nettoyées ci-dessus).
      await prisma.notification.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.alert.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  it('0. prépare le scénario : point d’eau, 2 ventes (comptoir + client, paiement partiel), commande fournisseur + paiement partiel, dépense générale', async () => {
    const waterPointRes = await request(app.getHttpServer())
      .post('/api/v1/water-points')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Point Eau Trésorerie Test',
        initialIndex: 0,
        tariffFcfaPerM3: 500,
        responsibleId: ownerUserId,
      })
      .expect(201);
    waterPointId = body<WaterPointResponseBody>(waterPointRes).id;
    createdWaterPointIds.push(waterPointId);

    // Vente comptoir (CA = 5 000, aucune créance possible : pas de client).
    const counterSaleRes = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productType: 'EAU',
        waterPointId,
        date: DAY1.toISOString(),
        saleMode: 'UNITE',
        quantity: 10,
        unitPriceFcfa: 500,
        status: 'CONFIRMEE',
      })
      .expect(201);
    createdSaleIds.push(body<SaleResponseBody>(counterSaleRes).id);

    // Vente à un client identifié (CA = 10 000), payée partiellement
    // (4 000) -> créance résiduelle de 6 000.
    const customerSaleRes = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productType: 'EAU',
        waterPointId,
        date: DAY1.toISOString(),
        customerId,
        saleMode: 'UNITE',
        quantity: 20,
        unitPriceFcfa: 500,
        status: 'CONFIRMEE',
      })
      .expect(201);
    const customerSaleId = body<SaleResponseBody>(customerSaleRes).id;
    createdSaleIds.push(customerSaleId);

    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        saleId: customerSaleId,
        date: DAY1.toISOString(),
        method: 'Espèces',
        amountFcfa: 4_000,
      })
      .expect(201);

    // Commande fournisseur (10 000), payée partiellement (6 000) -> dette
    // résiduelle de 4 000.
    const itemRes = await request(app.getHttpServer())
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Article Trésorerie Test', category: 'Test', unit: 'kg' })
      .expect(201);
    itemId = body<{ id: string }>(itemRes).id;
    createdItemIds.push(itemId);

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        supplierId,
        date: DAY1.toISOString(),
        items: [{ itemId, orderedQuantity: 10, unitPriceFcfa: 1_000 }],
      })
      .expect(201);
    purchaseOrderId = body<PurchaseOrderResponseBody>(orderRes).id;
    createdOrderIds.push(purchaseOrderId);

    await request(app.getHttpServer())
      .post('/api/v1/supplier-payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ purchaseOrderId, date: DAY1.toISOString(), method: 'Virement', amountFcfa: 6_000 })
      .expect(201);

    // Dépense générale (2 000), non rattachée à une commande.
    await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: DAY1.toISOString(), category: 'Autres', amountFcfa: 2_000 })
      .expect(201);
  });

  it('1. le journal reflète les 3 écritures (1 encaissement, 2 décaissements) avec les bons totaux', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/treasury/journal?from=${DAY1.toISOString()}&to=${DAY1.toISOString()}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const journal = body<JournalResponseBody>(res);

    expect(journal.entries).toHaveLength(3);
    const payment = journal.entries.find((e) => e.source === 'payment');
    const supplierPayment = journal.entries.find((e) => e.source === 'supplier_payment');
    const expense = journal.entries.find((e) => e.source === 'expense');
    expect(payment).toMatchObject({ type: 'ENCAISSEMENT', amountFcfa: 4_000 });
    expect(supplierPayment).toMatchObject({ type: 'DECAISSEMENT', amountFcfa: 6_000 });
    expect(expense).toMatchObject({ type: 'DECAISSEMENT', amountFcfa: 2_000 });

    expect(journal.totalEncaissementsFcfa).toBe(4_000);
    expect(journal.totalDecaissementsFcfa).toBe(8_000);
    expect(journal.netFcfa).toBe(-4_000);
  });

  it('2. les créances clients reflètent le solde résiduel (6 000), un client soldé n’apparaît pas', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/treasury/receivables')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const receivables = body<ReceivableResponseBody[]>(res);
    const ours = receivables.find((r) => r.customerId === customerId);
    expect(ours?.balanceFcfa).toBe(6_000);
  });

  it('3. les dettes fournisseurs reflètent le solde résiduel (4 000)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/treasury/payables')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const payables = body<PayableResponseBody[]>(res);
    const ours = payables.find((p) => p.supplierId === supplierId);
    expect(ours?.balanceFcfa).toBe(4_000);
  });

  it('4. la vue consolidée calcule CA, charges, marge et trésorerie nette sur la période', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/treasury/summary?from=${DAY1.toISOString()}&to=${DAY1.toISOString()}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const summary = body<SummaryResponseBody>(res);

    // CA = 5 000 (comptoir) + 10 000 (client) = 15 000.
    expect(summary.revenueFcfa).toBe(15_000);
    // Charges = uniquement la dépense générale (2 000) — le paiement
    // fournisseur alimente le stock, ce n'est pas une charge P&L.
    expect(summary.totalExpensesFcfa).toBe(2_000);
    expect(summary.grossMarginFcfa).toBe(13_000);
    // Trésorerie nette = encaissements (4 000) - décaissements fournisseur
    // (6 000) - dépenses (2 000) = -4 000, cohérent avec le journal.
    expect(summary.netTreasuryFcfa).toBe(-4_000);
  });

  describe('Isolation farmId et RBAC', () => {
    let readerBToken: string;
    let vendeurRoleId: string;
    let vendeurToken: string;

    beforeAll(async () => {
      const reader = await createActiveUser(
        prisma,
        passwordService,
        farmB.id,
        lecteurRoleId,
        'ReaderBTreasuryTest!2026',
      );
      createdUserIds.push(reader.id);
      const readerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email: reader.email, password: 'ReaderBTreasuryTest!2026' })
        .expect(200);
      readerBToken = body<LoginResponseBody>(readerRes).accessToken!;

      const vendeurRole = (await prisma.role.findMany({ where: { farmId: null } })).find(
        (r) => r.name === 'Vendeur / Caisse',
      );
      if (!vendeurRole) {
        throw new Error('Rôle Vendeur / Caisse introuvable.');
      }
      vendeurRoleId = vendeurRole.id;
      const vendeur = await createActiveUser(
        prisma,
        passwordService,
        farmA.id,
        vendeurRoleId,
        'VendeurTreasuryTest!2026',
      );
      createdUserIds.push(vendeur.id);
      const vendeurRes = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email: vendeur.email, password: 'VendeurTreasuryTest!2026' })
        .expect(200);
      vendeurToken = body<LoginResponseBody>(vendeurRes).accessToken!;
    });

    it('un token de la ferme B ne voit jamais les écritures de la ferme A (isolation farmId, pas de fuite cross-tenant)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/treasury/summary?from=${DAY1.toISOString()}&to=${DAY1.toISOString()}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(200);
      expect(body<SummaryResponseBody>(res).revenueFcfa).toBe(0);
    });

    it('un Vendeur / Caisse (sans TREASURY_READ) ne peut pas consulter la trésorerie — 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/treasury/payables')
        .set('Authorization', `Bearer ${vendeurToken}`)
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });
  });
});
