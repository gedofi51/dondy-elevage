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
 * Bâtiments/Blocs — Option A (additif, facultatif) retenue à l'issue de
 * l'investigation dédiée (voir DETTE_TECHNIQUE.md). Couvre : CRUD Block,
 * isolation farmId, RBAC (permissions BUILDINGS_* réutilisées, pas de
 * permission BLOCKS_* dédiée), validation bloc↔bâtiment↔ferme sur les 3
 * bandes concernées (Broiler/Layer/Breeder), effacement onDelete: SetNull
 * (suppression d'un bloc ≠ suppression/blocage des bandes qui l'utilisent),
 * et la garde de suppression ajoutée sur Building avec ce lot.
 */
jest.setTimeout(30_000);

interface BlockResponseBody {
  id: string;
  farmId: string;
  buildingId: string;
  name: string;
  code: string | null;
}
interface BuildingResponseBody {
  id: string;
  name: string;
}
interface BroilerBatchResponseBody {
  id: string;
  buildingId: string;
  blockId: string | null;
}
interface LayerBatchResponseBody {
  id: string;
  blockId: string | null;
}
interface BreederBatchResponseBody {
  id: string;
  blockId: string | null;
}
interface ErrorBody {
  message: string | string[];
}

const FULL_ACCESS_ROLE = 'Propriétaire / Administrateur';
const NO_ACCESS_ROLE = 'Vendeur / Caisse';

describe('Bâtiments/Blocs — Option A (e2e)', () => {
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
  let ownerAId: string;
  let ownerTokenA: string;
  let ownerTokenB: string;
  let buildingA1Id: string;
  let buildingA2Id: string;
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
    for (const name of [FULL_ACCESS_ROLE, NO_ACCESS_ROLE]) {
      if (!roleIdByName.has(name)) {
        throw new Error(`Rôle "${name}" introuvable — lancer \`npm run db:seed\` avant les tests.`);
      }
    }

    farmA = await prisma.farm.create({ data: { name: `Ferme Test A (blocks e2e ${Date.now()})` } });
    farmB = await prisma.farm.create({ data: { name: `Ferme Test B (blocks e2e ${Date.now()})` } });

    const ownerA = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleIdByName.get(FULL_ACCESS_ROLE)!,
      'UnusedPassword!2026',
    );
    ownerAId = ownerA.id;
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

    const buildingA1 = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ name: 'Poulailler A1', type: 'poulailler' })
      .expect(201);
    buildingA1Id = body<BuildingResponseBody>(buildingA1).id;
    createdBuildingIds.push(buildingA1Id);

    const buildingA2 = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ name: 'Poulailler A2', type: 'poulailler' })
      .expect(201);
    buildingA2Id = body<BuildingResponseBody>(buildingA2).id;
    createdBuildingIds.push(buildingA2Id);

    const buildingB = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({ name: 'Poulailler B', type: 'poulailler' })
      .expect(201);
    buildingBId = body<BuildingResponseBody>(buildingB).id;
    createdBuildingIds.push(buildingBId);
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.breederBatch.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.layerBatch.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.broilerDailyRecord.deleteMany({
        where: { farmId: { in: [farmA.id, farmB.id] } },
      });
      await prisma.broilerBatch.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.block.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.building.deleteMany({ where: { id: { in: createdBuildingIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  it('POST /blocks crée un bloc rattaché à un bâtiment de la même ferme', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/blocks')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ buildingId: buildingA1Id, name: 'Bloc Nord', code: 'N1' })
      .expect(201);
    const created = body<BlockResponseBody>(res);
    expect(created.buildingId).toBe(buildingA1Id);
    expect(created.farmId).toBe(farmA.id);
    expect(created.code).toBe('N1');
  });

  it('POST /blocks rejette un buildingId appartenant à une autre ferme (404)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/blocks')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ buildingId: buildingBId, name: 'Tentative inter-ferme' })
      .expect(404);
    expect(body<ErrorBody>(res).message).toContain('Bâtiment introuvable');
  });

  it('GET /blocks liste uniquement les blocs de la ferme de l’acteur', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/blocks')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);
    const blocks = body<BlockResponseBody[]>(res);
    expect(blocks.every((b) => b.farmId === farmA.id)).toBe(true);
  });

  it('PATCH /blocks/:id modifie nom/code (buildingId non modifiable — absent du DTO)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/blocks')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ buildingId: buildingA1Id, name: 'Bloc à renommer' })
      .expect(201);
    const id = body<BlockResponseBody>(createRes).id;

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/blocks/${id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ name: 'Bloc renommé', code: 'R1' })
      .expect(200);
    const updated = body<BlockResponseBody>(updateRes);
    expect(updated.name).toBe('Bloc renommé');
    expect(updated.code).toBe('R1');
    expect(updated.buildingId).toBe(buildingA1Id);
  });

  it('isolation farmId : un Propriétaire ne peut ni lire ni modifier un bloc d’une autre ferme (404)', async () => {
    const blockB = await request(app.getHttpServer())
      .post('/api/v1/blocks')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({ buildingId: buildingBId, name: 'Bloc Ferme B' })
      .expect(201);
    const blockBId = body<BlockResponseBody>(blockB).id;

    await request(app.getHttpServer())
      .get(`/api/v1/blocks/${blockBId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/blocks/${blockBId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ name: 'Tentative Ferme A' })
      .expect(404);
  });

  it(`${NO_ACCESS_ROLE} : aucune permission BUILDINGS_* -> 403 sur GET/POST /blocks`, async () => {
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
      permissions: permissionsByRoleName.get(NO_ACCESS_ROLE)!,
    });

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/blocks')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body<ErrorResponseBody>(listRes).message).toContain('Permissions insuffisantes');

    await request(app.getHttpServer())
      .post('/api/v1/blocks')
      .set('Authorization', `Bearer ${token}`)
      .send({ buildingId: buildingA1Id, name: 'X' })
      .expect(403);
  });

  describe('Validation bloc↔bâtiment↔ferme sur les bandes (Broiler/Layer/Breeder)', () => {
    let blockOnA1Id: string;
    let blockOnA2Id: string;
    let blockOnBId: string;

    beforeAll(async () => {
      const onA1 = await request(app.getHttpServer())
        .post('/api/v1/blocks')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ buildingId: buildingA1Id, name: 'Bloc validation A1' })
        .expect(201);
      blockOnA1Id = body<BlockResponseBody>(onA1).id;

      const onA2 = await request(app.getHttpServer())
        .post('/api/v1/blocks')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ buildingId: buildingA2Id, name: 'Bloc validation A2' })
        .expect(201);
      blockOnA2Id = body<BlockResponseBody>(onA2).id;

      const onB = await request(app.getHttpServer())
        .post('/api/v1/blocks')
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .send({ buildingId: buildingBId, name: 'Bloc validation B' })
        .expect(201);
      blockOnBId = body<BlockResponseBody>(onB).id;
    });

    it('POST /broiler-batches accepte un blockId appartenant au buildingId choisi', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/broiler-batches')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          arrivalDate: '2026-01-10',
          origin: 'NAISSANCE_INTERNE',
          orderedQuantity: 100,
          receivedQuantity: 100,
          unitPriceFcfa: 500,
          buildingId: buildingA1Id,
          blockId: blockOnA1Id,
          primaryManagerId: ownerAId,
        })
        .expect(201);
      const created = body<BroilerBatchResponseBody>(res);
      expect(created.blockId).toBe(blockOnA1Id);
    });

    it('POST /broiler-batches rejette un blockId appartenant à un AUTRE bâtiment de la même ferme (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/broiler-batches')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          arrivalDate: '2026-01-10',
          origin: 'NAISSANCE_INTERNE',
          orderedQuantity: 100,
          receivedQuantity: 100,
          unitPriceFcfa: 500,
          buildingId: buildingA1Id,
          blockId: blockOnA2Id,
          primaryManagerId: ownerAId,
        })
        .expect(400);
      expect(body<ErrorBody>(res).message).toContain("n'appartient pas au bâtiment");
    });

    it('POST /broiler-batches rejette un blockId d’une autre ferme (404)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/broiler-batches')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          arrivalDate: '2026-01-10',
          origin: 'NAISSANCE_INTERNE',
          orderedQuantity: 100,
          receivedQuantity: 100,
          unitPriceFcfa: 500,
          buildingId: buildingA1Id,
          blockId: blockOnBId,
          primaryManagerId: ownerAId,
        })
        .expect(404);
      expect(body<ErrorBody>(res).message).toContain('Bloc introuvable');
    });

    it('PATCH /broiler-batches/:id accepte blockId: null pour effacer le bloc', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/broiler-batches')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          arrivalDate: '2026-01-10',
          origin: 'NAISSANCE_INTERNE',
          orderedQuantity: 100,
          receivedQuantity: 100,
          unitPriceFcfa: 500,
          buildingId: buildingA1Id,
          blockId: blockOnA1Id,
          primaryManagerId: ownerAId,
        })
        .expect(201);
      const id = body<BroilerBatchResponseBody>(createRes).id;

      const clearRes = await request(app.getHttpServer())
        .patch(`/api/v1/broiler-batches/${id}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ blockId: null })
        .expect(200);
      expect(body<BroilerBatchResponseBody>(clearRes).blockId).toBeNull();
    });

    it('DELETE /blocks/:id efface (SetNull) le blockId des bandes qui l’utilisaient, sans les bloquer ni les supprimer', async () => {
      const blockRes = await request(app.getHttpServer())
        .post('/api/v1/blocks')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ buildingId: buildingA1Id, name: 'Bloc à supprimer' })
        .expect(201);
      const blockId = body<BlockResponseBody>(blockRes).id;

      const batchRes = await request(app.getHttpServer())
        .post('/api/v1/broiler-batches')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          arrivalDate: '2026-01-10',
          origin: 'NAISSANCE_INTERNE',
          orderedQuantity: 100,
          receivedQuantity: 100,
          unitPriceFcfa: 500,
          buildingId: buildingA1Id,
          blockId,
          primaryManagerId: ownerAId,
        })
        .expect(201);
      const batchId = body<BroilerBatchResponseBody>(batchRes).id;

      await request(app.getHttpServer())
        .delete(`/api/v1/blocks/${blockId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(204);

      const refetch = await request(app.getHttpServer())
        .get(`/api/v1/broiler-batches/${batchId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200);
      expect(body<BroilerBatchResponseBody>(refetch).blockId).toBeNull();
    });

    it('POST /layer-batches accepte un blockId valide et rejette un blockId d’un autre bâtiment (400)', async () => {
      const ok = await request(app.getHttpServer())
        .post('/api/v1/layer-batches')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          entryDate: '2026-01-10',
          initialQuantity: 100,
          buildingId: buildingA1Id,
          blockId: blockOnA1Id,
          primaryManagerId: ownerAId,
        })
        .expect(201);
      expect(body<LayerBatchResponseBody>(ok).blockId).toBe(blockOnA1Id);

      const rejected = await request(app.getHttpServer())
        .post('/api/v1/layer-batches')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          entryDate: '2026-01-10',
          initialQuantity: 100,
          buildingId: buildingA1Id,
          blockId: blockOnA2Id,
          primaryManagerId: ownerAId,
        })
        .expect(400);
      expect(body<ErrorBody>(rejected).message).toContain("n'appartient pas au bâtiment");
    });

    it('POST /breeder-batches accepte un blockId valide et rejette un blockId d’un autre bâtiment (400)', async () => {
      const ok = await request(app.getHttpServer())
        .post('/api/v1/breeder-batches')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          constitutionDate: '2026-01-10',
          femaleCount: 50,
          maleCount: 10,
          buildingId: buildingA1Id,
          blockId: blockOnA1Id,
          primaryManagerId: ownerAId,
        })
        .expect(201);
      expect(body<BreederBatchResponseBody>(ok).blockId).toBe(blockOnA1Id);

      const rejected = await request(app.getHttpServer())
        .post('/api/v1/breeder-batches')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          constitutionDate: '2026-01-10',
          femaleCount: 50,
          maleCount: 10,
          buildingId: buildingA1Id,
          blockId: blockOnA2Id,
          primaryManagerId: ownerAId,
        })
        .expect(400);
      expect(body<ErrorBody>(rejected).message).toContain("n'appartient pas au bâtiment");
    });
  });

  describe('BuildingsService.remove() — garde de suppression ajoutée avec ce lot', () => {
    it('DELETE /buildings/:id refuse un bâtiment utilisé par une bande (409)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/buildings/${buildingA1Id}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(409);
      expect(body<ErrorBody>(res).message).toContain('Suppression impossible');
    });

    it('DELETE /buildings/:id supprime un bâtiment vide (et ses blocs éventuels)', async () => {
      const buildingRes = await request(app.getHttpServer())
        .post('/api/v1/buildings')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ name: 'Bâtiment vide à supprimer', type: 'poulailler' })
        .expect(201);
      const emptyBuildingId = body<BuildingResponseBody>(buildingRes).id;

      await request(app.getHttpServer())
        .post('/api/v1/blocks')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ buildingId: emptyBuildingId, name: 'Bloc du bâtiment vide' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/buildings/${emptyBuildingId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(204);
    });
  });
});
