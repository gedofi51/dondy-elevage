import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { AssetsAlertsCronService } from '../src/modules/assets/assets-alerts.cron';
import {
  body,
  closeAppSafely,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Scénario d'acceptation V6 §19, rejoué de bout en bout contre une vraie
 * base MySQL (pas de mocks) : "Actif solaire acheté → Fiche créée, coût
 * enregistré, plan d'amortissement généré." Complété par isolation
 * farmId, RBAC (Propriétaire/Comptable/Lecteur), garde de suppression
 * (activité réelle = Expense.assetId, pas les DepreciationEntry
 * placeholder), statut terminal REFORME (jamais via PATCH générique),
 * et les 2 alertes patrimoine (garantie expirante, totalement amorti).
 */
jest.setTimeout(30_000);

interface DepreciationEntryResponseBody {
  periodNumber: number;
  dotationFcfa: number;
  cumulativeFcfa: number;
  netBookValueFcfa: number;
}
interface AssetResponseBody {
  id: string;
  code: string;
  status: string;
  totalAcquisitionCostFcfa: number;
  accumulatedDepreciationFcfa: number;
  netBookValueFcfa: number;
  tcoFcfa: number;
}

describe('Patrimoine & Amortissements — cycle complet (e2e, scénario V6 §19)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let assetsAlertsCron: AssetsAlertsCronService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;
  let lecteurRoleId: string;
  let comptableRoleId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let supplierId: string;

  const createdUserIds: string[] = [];
  const createdAssetIds: string[] = [];

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
    assetsAlertsCron = app.get(AssetsAlertsCronService);

    const roles = await prisma.role.findMany({ where: { farmId: null } });
    const proprietaireRole = roles.find((r) => r.name === 'Propriétaire / Administrateur');
    const lecteurRole = roles.find((r) => r.name === 'Lecteur / Lecture seule');
    const comptableRole = roles.find((r) => r.name === 'Comptable / Responsable financier');
    if (!proprietaireRole || !lecteurRole || !comptableRole) {
      throw new Error(
        'Référentiel de rôles introuvable — lancer `npm run db:seed` avant les tests.',
      );
    }
    proprietaireRoleId = proprietaireRole.id;
    lecteurRoleId = lecteurRole.id;
    comptableRoleId = comptableRole.id;

    farmA = await prisma.farm.create({ data: { name: `Ferme Test A (assets e2e ${Date.now()})` } });
    farmB = await prisma.farm.create({ data: { name: `Ferme Test B (assets e2e ${Date.now()})` } });

    const { id: userId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      proprietaireRoleId,
      'OwnerAssetsTest!2026',
    );
    ownerUserId = userId;
    createdUserIds.push(userId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'OwnerAssetsTest!2026' })
      .expect(200);
    ownerToken = body<LoginResponseBody>(loginRes).accessToken!;

    const supplier = await prisma.supplier.create({
      data: {
        farmId: farmA.id,
        name: 'Fournisseur Solaire Test',
        category: 'équipement',
        createdBy: ownerUserId,
      },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    // closeAppSafely : app.close() DOIT s'exécuter même si le nettoyage
    // échoue (ex. contrainte FK oubliée) — sinon l'application Nest de
    // test reste vivante (ScheduleModule/@Cron d'AssetsAlertsCronService
    // inclus) et Jest ne se termine jamais. Trouvé en vérification
    // manuelle cette phase : un `id` non capturé sur 2 createActiveUser()
    // laissait des User orphelins référençant farmId, faisant échouer
    // farm.deleteMany() en FK et bloquant tout le fichier plusieurs
    // heures (voir DETTE_TECHNIQUE.md Phase 16 — même incident que
    // treasury.e2e-spec.ts Phase 8, généralisé ici en helper partagé).
    await closeAppSafely(app, async () => {
      // Ordre sûr vis-à-vis des FK : dépenses -> lignes d'amortissement ->
      // actifs -> référence fournisseur -> alertes/notifications/audit ->
      // utilisateurs -> fermes.
      await prisma.expense.deleteMany({ where: { assetId: { in: createdAssetIds } } });
      await prisma.depreciationEntry.deleteMany({ where: { assetId: { in: createdAssetIds } } });
      await prisma.asset.deleteMany({ where: { id: { in: createdAssetIds } } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
      await prisma.notification.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.alert.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  let solarAssetId: string;

  it('1. crée un actif solaire — scénario §19 (fiche créée, coût enregistré)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        designation: 'Panneaux solaires 5kW',
        category: 'Solaire',
        supplierId,
        purchaseDate: '2026-01-01',
        serviceDate: '2026-01-01',
        purchasePriceFcfa: 2_000_000,
        installationCostFcfa: 200_000,
        location: 'Toiture magasin',
        responsibleId: ownerUserId,
        residualValueFcfa: 200_000,
        depreciationDurationYears: 10,
      })
      .expect(201);

    const asset = body<AssetResponseBody>(res);
    expect(asset.code).toMatch(/^PAT-2026-\d{3}$/);
    expect(asset.status).toBe('ACTIF');
    expect(asset.totalAcquisitionCostFcfa).toBe(2_200_000);
    // Aucune période écoulée à la date du test (serviceDate = mise en
    // service future/aujourd'hui) : rien n'est encore accumulé.
    expect(asset.accumulatedDepreciationFcfa).toBe(0);
    expect(asset.netBookValueFcfa).toBe(2_200_000);
    expect(asset.tcoFcfa).toBe(2_200_000);

    solarAssetId = asset.id;
    createdAssetIds.push(solarAssetId);
  });

  it("2. le plan d'amortissement est généré atomiquement — 10 lignes, prorata Jan1 = aucun, VNC finale = résiduelle", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/assets/${solarAssetId}/depreciation-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const entries = body<DepreciationEntryResponseBody[]>(res);
    expect(entries).toHaveLength(10);
    expect(entries.every((e) => e.dotationFcfa === 200_000)).toBe(true);
    const last = entries[entries.length - 1]!;
    expect(last.periodNumber).toBe(10);
    expect(last.cumulativeFcfa).toBe(2_000_000);
    expect(last.netBookValueFcfa).toBe(200_000);
  });

  it('3. isolation multi-tenant — GET /assets/:id de la ferme A avec un token de la ferme B → 404 générique', async () => {
    const { id: lecteurBUserId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmB.id,
      lecteurRoleId,
      'LecteurBAssetsTest!2026',
    );
    createdUserIds.push(lecteurBUserId);
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'LecteurBAssetsTest!2026' })
      .expect(200);
    const lecteurBToken = body<LoginResponseBody>(loginRes).accessToken!;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/assets/${solarAssetId}`)
      .set('Authorization', `Bearer ${lecteurBToken}`)
      .expect(404);
    expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');

    await request(app.getHttpServer())
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${lecteurBToken}`)
      .send({
        designation: 'Interdit',
        category: 'Outillage',
        purchaseDate: '2026-01-01',
        serviceDate: '2026-01-01',
        purchasePriceFcfa: 1_000,
        responsibleId: ownerUserId,
        depreciationDurationYears: 1,
      })
      .expect(403);
  });

  describe('RBAC — Comptable vs Lecteur', () => {
    let comptableAToken: string;
    let comptableAssetId: string;

    beforeAll(async () => {
      const { id: comptableUserId, email } = await createActiveUser(
        prisma,
        passwordService,
        farmA.id,
        comptableRoleId,
        'ComptableAssetsTest!2026',
      );
      createdUserIds.push(comptableUserId);
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email, password: 'ComptableAssetsTest!2026' })
        .expect(200);
      comptableAToken = body<LoginResponseBody>(loginRes).accessToken!;
    });

    it('un Comptable peut créer, lire et modifier un actif (mandat financier)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${comptableAToken}`)
        .send({
          designation: 'Actif Comptable',
          category: 'Informatique',
          purchaseDate: '2026-01-01',
          serviceDate: '2026-01-01',
          purchasePriceFcfa: 500_000,
          responsibleId: ownerUserId,
          depreciationDurationYears: 3,
        })
        .expect(201);
      comptableAssetId = body<AssetResponseBody>(createRes).id;
      createdAssetIds.push(comptableAssetId);

      await request(app.getHttpServer())
        .patch(`/api/v1/assets/${comptableAssetId}`)
        .set('Authorization', `Bearer ${comptableAToken}`)
        .send({ location: 'Bureau administratif' })
        .expect(200);
    });

    it('un Comptable ne peut PAS supprimer un actif — 403 (même profil que EXPENSES_DELETE, absent)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/assets/${comptableAssetId}`)
        .set('Authorization', `Bearer ${comptableAToken}`)
        .expect(403);
    });

    it('un Comptable peut réformer un actif — ASSETS_REFORM aligné sur PURCHASE_ORDERS_CLOSE', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/assets/${comptableAssetId}/reformer`)
        .set('Authorization', `Bearer ${comptableAToken}`)
        .send({ reformReason: 'Test RBAC' })
        .expect(201);
      expect(body<AssetResponseBody>(res).status).toBe('REFORME');
    });
  });

  it('4. le PATCH générique rejette status=REFORME (400) — seul POST /:id/reformer y mène', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/assets/${solarAssetId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'REFORME' })
      .expect(400);
  });

  describe('Garde de suppression — activité réelle (Expense.assetId), pas les lignes placeholder', () => {
    let assetWithExpenseId: string;
    let deletableAssetId: string;

    beforeAll(async () => {
      const withExpenseRes = await request(app.getHttpServer())
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          designation: 'Actif avec dépense liée',
          category: 'Outillage',
          purchaseDate: '2026-01-01',
          serviceDate: '2026-01-01',
          purchasePriceFcfa: 50_000,
          responsibleId: ownerUserId,
          depreciationDurationYears: 5,
        })
        .expect(201);
      assetWithExpenseId = body<AssetResponseBody>(withExpenseRes).id;
      createdAssetIds.push(assetWithExpenseId);

      await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: assetWithExpenseId,
          date: '2026-02-01',
          category: 'reparation',
          amountFcfa: 5_000,
        })
        .expect(201);

      const deletableRes = await request(app.getHttpServer())
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          designation: 'Actif à supprimer',
          category: 'Outillage',
          purchaseDate: '2026-01-01',
          serviceDate: '2026-01-01',
          purchasePriceFcfa: 30_000,
          responsibleId: ownerUserId,
          depreciationDurationYears: 3,
        })
        .expect(201);
      deletableAssetId = body<AssetResponseBody>(deletableRes).id;
    });

    it('bloque la suppression (409) si une dépense est rattachée à l’actif', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/assets/${assetWithExpenseId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);
      expect(body<ErrorResponseBody>(res).message).toContain('réforme');
    });

    it('autorise la suppression sans dépense liée — les DepreciationEntry sont supprimées en cascade (pas append-only)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/assets/${deletableAssetId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      const remainingEntries = await prisma.depreciationEntry.findMany({
        where: { assetId: deletableAssetId },
      });
      expect(remainingEntries).toHaveLength(0);
      const remainingAsset = await prisma.asset.findUnique({ where: { id: deletableAssetId } });
      expect(remainingAsset).toBeNull();
    });
  });

  describe('Réforme — statut terminal, VNC plafonnée au reformDate', () => {
    let reformAssetId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          designation: 'Petit outillage à réformer',
          category: 'Outillage',
          purchaseDate: '2026-01-01',
          serviceDate: '2026-01-01',
          purchasePriceFcfa: 100_000,
          responsibleId: ownerUserId,
          depreciationDurationYears: 5,
        })
        .expect(201);
      reformAssetId = body<AssetResponseBody>(res).id;
      createdAssetIds.push(reformAssetId);
    });

    it('réforme l’actif à mi-année 2027 — accumulatedDepreciation/VNC plafonnés à la seule période 2026 déjà écoulée', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/assets/${reformAssetId}/reformer`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reformDate: '2027-06-30', reformReason: 'Matériel hors service' })
        .expect(201);

      const asset = body<AssetResponseBody>(res);
      expect(asset.status).toBe('REFORME');
      // 5 ans, dotation annuelle = 20 000 — seule la période 2026
      // (periodEnd 2026-12-31) est déjà écoulée au 2027-06-30.
      expect(asset.accumulatedDepreciationFcfa).toBe(20_000);
      expect(asset.netBookValueFcfa).toBe(80_000);

      const entries = await prisma.depreciationEntry.findMany({
        where: { assetId: reformAssetId },
      });
      // Les lignes post-réforme restent en base, jamais supprimées.
      expect(entries).toHaveLength(5);
    });

    it('réformer un actif déjà réformé → 409', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${reformAssetId}/reformer`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);
    });
  });

  describe('Alertes patrimoine (AssetsAlertsCronService)', () => {
    let warrantyAssetId: string;
    let fullyDepreciatedAssetId: string;

    beforeAll(async () => {
      const warrantyExpiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const warrantyRes = await request(app.getHttpServer())
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          designation: 'Actif sous garantie',
          category: 'Informatique',
          purchaseDate: '2026-01-01',
          serviceDate: '2026-01-01',
          purchasePriceFcfa: 10_000,
          responsibleId: ownerUserId,
          depreciationDurationYears: 3,
          warrantyExpiresAt,
        })
        .expect(201);
      warrantyAssetId = body<AssetResponseBody>(warrantyRes).id;
      createdAssetIds.push(warrantyAssetId);

      const fullyDepreciatedRes = await request(app.getHttpServer())
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          designation: 'Actif totalement amorti',
          category: 'Outillage',
          purchaseDate: '2020-01-01',
          serviceDate: '2020-01-01',
          purchasePriceFcfa: 20_000,
          responsibleId: ownerUserId,
          depreciationDurationYears: 2,
        })
        .expect(201);
      fullyDepreciatedAssetId = body<AssetResponseBody>(fullyDepreciatedRes).id;
      createdAssetIds.push(fullyDepreciatedAssetId);
    });

    it('lève une alerte VIGILANCE (garantie expirant sous 30 jours) au premier balayage, jamais deux fois au second', async () => {
      await assetsAlertsCron.runDailySweep();

      const alertsAfterFirst = await prisma.alert.findMany({
        where: { entityType: 'asset', entityId: warrantyAssetId },
      });
      expect(alertsAfterFirst).toHaveLength(1);
      expect(alertsAfterFirst[0]!.type).toBe('asset_warranty_expiring');
      expect(alertsAfterFirst[0]!.severity).toBe('VIGILANCE');

      await assetsAlertsCron.runDailySweep();
      const alertsAfterSecond = await prisma.alert.findMany({
        where: { entityType: 'asset', entityId: warrantyAssetId },
      });
      expect(alertsAfterSecond).toHaveLength(1);
    });

    it('lève une alerte INFO (actif totalement amorti) — idempotente également', async () => {
      await assetsAlertsCron.runDailySweep();

      const alertsAfterFirst = await prisma.alert.findMany({
        where: { entityType: 'asset', entityId: fullyDepreciatedAssetId },
      });
      expect(alertsAfterFirst).toHaveLength(1);
      expect(alertsAfterFirst[0]!.type).toBe('asset_fully_depreciated');
      expect(alertsAfterFirst[0]!.severity).toBe('INFO');

      await assetsAlertsCron.runDailySweep();
      const alertsAfterSecond = await prisma.alert.findMany({
        where: { entityType: 'asset', entityId: fullyDepreciatedAssetId },
      });
      expect(alertsAfterSecond).toHaveLength(1);
    });
  });
});
