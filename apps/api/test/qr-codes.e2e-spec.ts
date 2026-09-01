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
 * QR Codes (Lot 1 "fondations", cahier V6 §9) — périmètre confirmé après
 * investigation : BROILER_BATCH/LAYER_BATCH/ASSET/ITEM (seules entités
 * avec une fiche de lecture réelle côté web ; Building/Incubator reportés,
 * voir DETTE_TECHNIQUE.md). Couvre : génération/régénération/révocation,
 * résolution par type (redirection RBAC/farmId identique à un accès
 * direct), isolation farmId, RBAC (au moins un rôle avec accès et un
 * sans, par action).
 */
jest.setTimeout(30_000);

interface QrCodeGeneratedBody {
  id: string;
  entityType: string;
  entityId: string;
  revoked: boolean;
  scanCount: number;
  lastScannedAt: string | null;
  scanUrl: string;
  qrCodeDataUrl: string;
}
interface QrCodeStatusBody {
  id: string;
  entityType: string;
  entityId: string;
  revoked: boolean;
  scanCount: number;
  lastScannedAt: string | null;
}
interface QrCodeResolutionBody {
  entityType: string;
  entityId: string;
}
interface BuildingResponseBody {
  id: string;
}
interface EntityIdResponseBody {
  id: string;
}

const FULL_ACCESS_ROLE = 'Propriétaire / Administrateur';
const READ_ONLY_ROLE = 'Lecteur / Lecture seule';
/** Vendeur/Caisse : BROILER_BATCHES_READ/LAYER_BATCHES_READ mais aucune
 * permission ASSETS_ ou ITEMS_, et aucune permission UPDATE nulle part
 * (voir roles.catalog.ts) — un seul rôle couvre à la fois "accès partiel
 * en lecture" (Broiler/Layer) et "aucun accès" (Asset/Item, et écriture
 * partout) pour la matrice RBAC. */
const PARTIAL_ROLE = 'Vendeur / Caisse';

function extractToken(scanUrl: string): string {
  const token = scanUrl.split('/scanner/')[1];
  if (!token) {
    throw new Error(`scanUrl inattendu (pas de segment /scanner/) : ${scanUrl}`);
  }
  return token;
}

describe('QR Codes — génération/révocation, résolution, RBAC, isolation farmId (e2e, Lot 1)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let tokenService: TokenService;

  let farmA: { id: string };
  let farmB: { id: string };
  let roleIdByName: Map<string, string>;
  const permissionsByRoleName = new Map(ROLES_CATALOG.map((r) => [r.name, r.permissions]));

  const createdUserIds: string[] = [];
  const createdBuildingIds: string[] = [];
  const createdBroilerBatchIds: string[] = [];
  const createdLayerBatchIds: string[] = [];
  const createdAssetIds: string[] = [];
  const createdItemIds: string[] = [];

  let ownerTokenA: string;
  let ownerUserIdA: string;
  let buildingAId: string;

  let ownerTokenB: string;
  let buildingBId: string;

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
    for (const name of [FULL_ACCESS_ROLE, READ_ONLY_ROLE, PARTIAL_ROLE]) {
      if (!roleIdByName.has(name)) {
        throw new Error(`Rôle "${name}" introuvable — lancer \`npm run db:seed\` avant les tests.`);
      }
    }

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (qr-codes e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (qr-codes e2e ${Date.now()})` },
    });

    const ownerA = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleIdByName.get(FULL_ACCESS_ROLE)!,
      'UnusedPassword!2026',
    );
    ownerUserIdA = ownerA.id;
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

    const buildingResA = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ name: 'Bâtiment QR Test A', type: 'poulailler' })
      .expect(201);
    buildingAId = body<BuildingResponseBody>(buildingResA).id;
    createdBuildingIds.push(buildingAId);

    const buildingResB = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({ name: 'Bâtiment QR Test B', type: 'poulailler' })
      .expect(201);
    buildingBId = body<BuildingResponseBody>(buildingResB).id;
    createdBuildingIds.push(buildingBId);
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.qrCodeScan.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.qrCode.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      // BroilerDailyRecord : 45 lignes auto-générées par bande à la
      // création (même patron que assets.e2e-spec.ts pour DepreciationEntry)
      // — doivent être supprimées avant la bande elle-même (FK batchId).
      await prisma.broilerDailyRecord.deleteMany({
        where: { batchId: { in: createdBroilerBatchIds } },
      });
      await prisma.broilerBatch.deleteMany({ where: { id: { in: createdBroilerBatchIds } } });
      await prisma.layerBatch.deleteMany({ where: { id: { in: createdLayerBatchIds } } });
      // DepreciationEntry : lignes auto-générées par actif à la création
      // (même patron que BroilerDailyRecord ci-dessus) — voir
      // assets.e2e-spec.ts.
      await prisma.depreciationEntry.deleteMany({ where: { assetId: { in: createdAssetIds } } });
      await prisma.asset.deleteMany({ where: { id: { in: createdAssetIds } } });
      await prisma.item.deleteMany({ where: { id: { in: createdItemIds } } });
      await prisma.building.deleteMany({ where: { id: { in: createdBuildingIds } } });
      await prisma.notification.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.alert.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  async function mintToken(farmId: string, roleName: string): Promise<string> {
    const roleId = roleIdByName.get(roleName)!;
    const permissions = permissionsByRoleName.get(roleName)!;
    const { id } = await createActiveUser(
      prisma,
      passwordService,
      farmId,
      roleId,
      'UnusedPassword!2026',
    );
    createdUserIds.push(id);
    return tokenService.signAccessToken({ sub: id, farmId, roles: [roleName], permissions });
  }

  async function createBroilerBatch(
    token: string,
    buildingId: string,
    managerId: string,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/broiler-batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        arrivalDate: '2026-01-01',
        origin: 'NAISSANCE_INTERNE',
        orderedQuantity: 100,
        receivedQuantity: 100,
        unitPriceFcfa: 500,
        buildingId,
        primaryManagerId: managerId,
      })
      .expect(201);
    const id = body<EntityIdResponseBody>(res).id;
    createdBroilerBatchIds.push(id);
    return id;
  }

  async function createLayerBatch(
    token: string,
    buildingId: string,
    managerId: string,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/layer-batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entryDate: '2026-01-01',
        initialQuantity: 200,
        buildingId,
        primaryManagerId: managerId,
      })
      .expect(201);
    const id = body<EntityIdResponseBody>(res).id;
    createdLayerBatchIds.push(id);
    return id;
  }

  async function createAsset(token: string, responsibleId: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        designation: `Actif QR Test ${Date.now()}-${Math.random()}`,
        category: 'Test',
        purchaseDate: '2026-01-01',
        serviceDate: '2026-01-01',
        purchasePriceFcfa: 100_000,
        responsibleId,
        depreciationDurationYears: 5,
      })
      .expect(201);
    const id = body<EntityIdResponseBody>(res).id;
    createdAssetIds.push(id);
    return id;
  }

  async function createItem(token: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Article QR Test ${Date.now()}-${Math.random()}`,
        category: 'Test',
        unit: 'unité',
      })
      .expect(201);
    const id = body<EntityIdResponseBody>(res).id;
    createdItemIds.push(id);
    return id;
  }

  describe('Génération / régénération / révocation — cycle complet (BROILER_BATCH, représentatif)', () => {
    let batchId: string;

    beforeAll(async () => {
      batchId = await createBroilerBatch(ownerTokenA, buildingAId, ownerUserIdA);
    });

    it('POST .../qr-code génère un QR actif (201) — jamais de donnée métier encodée, juste un jeton opaque', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/broiler-batches/${batchId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);
      const created = body<QrCodeGeneratedBody>(res);
      expect(created.entityType).toBe('BROILER_BATCH');
      expect(created.entityId).toBe(batchId);
      expect(created.revoked).toBe(false);
      expect(created.scanCount).toBe(0);
      expect(created.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(created.scanUrl).toContain('/scanner/');
      // Le jeton lui-même : haute entropie, jamais l'id/code métier de la bande.
      const token = extractToken(created.scanUrl);
      expect(token).not.toContain(batchId);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("un second POST alors qu'un QR est déjà actif → 409", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/broiler-batches/${batchId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(409);
      expect(body<ErrorResponseBody>(res).message).toContain('existe déjà');
    });

    it('GET .../qr-code renvoie le statut courant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/broiler-batches/${batchId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200);
      const status = body<QrCodeStatusBody>(res);
      expect(status.revoked).toBe(false);
      expect(status.entityId).toBe(batchId);
    });

    it('POST .../qr-code/regenerer remplace le QR actif — ancien jeton ne résout plus, nouveau si', async () => {
      const statusRes = await request(app.getHttpServer())
        .get(`/api/v1/broiler-batches/${batchId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200);
      const oldId = body<QrCodeStatusBody>(statusRes).id;

      // Le jeton en clair n'est jamais renvoyé par GET (seulement à la
      // génération/régénération) — on le récupère donc via un nouveau
      // POST /regenerer directement, sans repasser par POST /qr-code
      // (qui échouerait en 409 tant qu'un QR reste actif).
      const regenRes = await request(app.getHttpServer())
        .post(`/api/v1/broiler-batches/${batchId}/qr-code/regenerer`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);
      const regenerated = body<QrCodeGeneratedBody>(regenRes);
      expect(regenerated.id).not.toBe(oldId);
      expect(regenerated.revoked).toBe(false);

      const newToken = extractToken(regenerated.scanUrl);
      const resolveRes = await request(app.getHttpServer())
        .get(`/api/v1/qr-codes/resoudre/${newToken}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200);
      expect(body<QrCodeResolutionBody>(resolveRes)).toEqual({
        entityType: 'BROILER_BATCH',
        entityId: batchId,
      });
    });

    it('POST .../qr-code/revoquer révoque le QR actif — la résolution échoue ensuite en 404', async () => {
      const regenRes = await request(app.getHttpServer())
        .post(`/api/v1/broiler-batches/${batchId}/qr-code/regenerer`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);
      const { scanUrl } = body<QrCodeGeneratedBody>(regenRes);
      const token = extractToken(scanUrl);

      await request(app.getHttpServer())
        .post(`/api/v1/broiler-batches/${batchId}/qr-code/revoquer`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);

      const statusRes = await request(app.getHttpServer())
        .get(`/api/v1/broiler-batches/${batchId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200);
      expect(body<QrCodeStatusBody>(statusRes).revoked).toBe(true);

      const resolveRes = await request(app.getHttpServer())
        .get(`/api/v1/qr-codes/resoudre/${token}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(404);
      expect(body<ErrorResponseBody>(resolveRes).message).toContain('introuvable');
    });

    it('révoquer sans QR actif → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/broiler-batches/${batchId}/qr-code/revoquer`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toContain('Aucun QR actif');
    });

    it('résoudre un jeton inconnu → 404', async () => {
      await request(app.getHttpServer())
        .get(
          '/api/v1/qr-codes/resoudre/0000000000000000000000000000000000000000000000000000000000000000',
        )
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(404);
    });
  });

  describe('Résolution par type — les 4 entités confirmées (BROILER_BATCH/LAYER_BATCH/ASSET/ITEM)', () => {
    it.each([
      ['BROILER_BATCH', 'broiler-batches'],
      ['LAYER_BATCH', 'layer-batches'],
      ['ASSET', 'assets'],
      ['ITEM', 'items'],
    ] as const)(
      '%s : générer puis scanner résout vers le bon (entityType, entityId)',
      async (entityType, routePrefix) => {
        let entityId: string;
        if (entityType === 'BROILER_BATCH')
          entityId = await createBroilerBatch(ownerTokenA, buildingAId, ownerUserIdA);
        else if (entityType === 'LAYER_BATCH')
          entityId = await createLayerBatch(ownerTokenA, buildingAId, ownerUserIdA);
        else if (entityType === 'ASSET') entityId = await createAsset(ownerTokenA, ownerUserIdA);
        else entityId = await createItem(ownerTokenA);

        const genRes = await request(app.getHttpServer())
          .post(`/api/v1/${routePrefix}/${entityId}/qr-code`)
          .set('Authorization', `Bearer ${ownerTokenA}`)
          .expect(201);
        const token = extractToken(body<QrCodeGeneratedBody>(genRes).scanUrl);

        const resolveRes = await request(app.getHttpServer())
          .get(`/api/v1/qr-codes/resoudre/${token}`)
          .set('Authorization', `Bearer ${ownerTokenA}`)
          .expect(200);
        expect(body<QrCodeResolutionBody>(resolveRes)).toEqual({ entityType, entityId });
      },
    );

    it('une entité supprimée depuis la génération résout en 404 (jamais une fiche fantôme)', async () => {
      const itemId = await createItem(ownerTokenA);
      const genRes = await request(app.getHttpServer())
        .post(`/api/v1/items/${itemId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);
      const token = extractToken(body<QrCodeGeneratedBody>(genRes).scanUrl);

      await prisma.item.delete({ where: { id: itemId } });
      createdItemIds.splice(createdItemIds.indexOf(itemId), 1);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/qr-codes/resoudre/${token}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toContain('introuvable');
    });
  });

  describe("RBAC — génération/régénération/révocation exigent la permission UPDATE de l'entité", () => {
    it(`${FULL_ACCESS_ROLE} : génère un QR pour un actif (a ASSETS_UPDATE) — 201`, async () => {
      const assetId = await createAsset(ownerTokenA, ownerUserIdA);
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${assetId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);
    });

    it(`${READ_ONLY_ROLE} : lecture seule (pas d'UPDATE) → 403 à la génération`, async () => {
      const assetId = await createAsset(ownerTokenA, ownerUserIdA);
      const token = await mintToken(farmA.id, READ_ONLY_ROLE);
      const res = await request(app.getHttpServer())
        .post(`/api/v1/assets/${assetId}/qr-code`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });

    it(`${PARTIAL_ROLE} : aucune permission ASSETS_* → 403 à la génération`, async () => {
      const assetId = await createAsset(ownerTokenA, ownerUserIdA);
      const token = await mintToken(farmA.id, PARTIAL_ROLE);
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${assetId}/qr-code`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe("RBAC — résolution exige la MÊME permission READ qu'un accès direct à la fiche", () => {
    it(`${READ_ONLY_ROLE} : a ITEMS_READ → résolution 200`, async () => {
      const itemId = await createItem(ownerTokenA);
      const genRes = await request(app.getHttpServer())
        .post(`/api/v1/items/${itemId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);
      const token = extractToken(body<QrCodeGeneratedBody>(genRes).scanUrl);

      const readerToken = await mintToken(farmA.id, READ_ONLY_ROLE);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/qr-codes/resoudre/${token}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(200);
      expect(body<QrCodeResolutionBody>(res).entityId).toBe(itemId);
    });

    it(`${PARTIAL_ROLE} : AUCUNE permission ITEMS_READ → résolution 403 (mêmes contrôles qu'un accès direct GET /items/:id)`, async () => {
      const itemId = await createItem(ownerTokenA);
      const genRes = await request(app.getHttpServer())
        .post(`/api/v1/items/${itemId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);
      const token = extractToken(body<QrCodeGeneratedBody>(genRes).scanUrl);

      const partialToken = await mintToken(farmA.id, PARTIAL_ROLE);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/qr-codes/resoudre/${token}`)
        .set('Authorization', `Bearer ${partialToken}`)
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });

    it(`${PARTIAL_ROLE} : a BROILER_BATCHES_READ → résolution 200 (même rôle, entité différente)`, async () => {
      const batchId = await createBroilerBatch(ownerTokenA, buildingAId, ownerUserIdA);
      const genRes = await request(app.getHttpServer())
        .post(`/api/v1/broiler-batches/${batchId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);
      const token = extractToken(body<QrCodeGeneratedBody>(genRes).scanUrl);

      const partialToken = await mintToken(farmA.id, PARTIAL_ROLE);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/qr-codes/resoudre/${token}`)
        .set('Authorization', `Bearer ${partialToken}`)
        .expect(200);
      expect(body<QrCodeResolutionBody>(res).entityId).toBe(batchId);
    });
  });

  describe("Isolation farmId — même discipline qu'un accès direct (404 générique, jamais 403)", () => {
    it('un QR généré en Ferme A ne résout jamais pour un utilisateur de la Ferme B (404)', async () => {
      const batchId = await createBroilerBatch(ownerTokenA, buildingAId, ownerUserIdA);
      const genRes = await request(app.getHttpServer())
        .post(`/api/v1/broiler-batches/${batchId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);
      const token = extractToken(body<QrCodeGeneratedBody>(genRes).scanUrl);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/qr-codes/resoudre/${token}`)
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toContain('introuvable');
    });

    it("un utilisateur de la Ferme B ne peut ni générer ni consulter le statut d'une fiche de la Ferme A (404)", async () => {
      const batchId = await createBroilerBatch(ownerTokenA, buildingAId, ownerUserIdA);

      await request(app.getHttpServer())
        .post(`/api/v1/broiler-batches/${batchId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/v1/broiler-batches/${batchId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .expect(404);
    });
  });

  describe('Historique de scans — écran de gestion', () => {
    it('chaque résolution réussie incrémente le compteur et journalise le scan', async () => {
      const itemId = await createItem(ownerTokenA);
      const genRes = await request(app.getHttpServer())
        .post(`/api/v1/items/${itemId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(201);
      const token = extractToken(body<QrCodeGeneratedBody>(genRes).scanUrl);

      await request(app.getHttpServer())
        .get(`/api/v1/qr-codes/resoudre/${token}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/v1/qr-codes/resoudre/${token}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200);

      const statusRes = await request(app.getHttpServer())
        .get(`/api/v1/items/${itemId}/qr-code`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200);
      expect(body<QrCodeStatusBody>(statusRes).scanCount).toBe(2);

      const scansRes = await request(app.getHttpServer())
        .get(`/api/v1/items/${itemId}/qr-code/scans`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200);
      expect(body<Array<{ id: string }>>(scansRes)).toHaveLength(2);
    });
  });
});
