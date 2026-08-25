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
 * CRUD Suppliers/Customers + isolation farmId croisée, même pattern que
 * auth-rbac.e2e-spec.ts (Phase 1) : vraie base MySQL, pas de mocks.
 */
jest.setTimeout(30_000);

interface SupplierResponseBody {
  id: string;
  farmId: string;
  name: string;
  category: string;
}
interface CustomerResponseBody {
  id: string;
  farmId: string;
  code: string;
  name: string;
  type: string;
}

describe('Suppliers + Customers — CRUD et isolation farmId (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;
  let lecteurRoleId: string;

  const createdUserIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdCustomerIds: string[] = [];

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
      data: { name: `Ferme Test A (suppliers e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (suppliers e2e ${Date.now()})` },
    });
  });

  afterAll(async () => {
    // closeAppSafely : app.close() s'exécute même si le nettoyage échoue
    // — voir DETTE_TECHNIQUE.md (incident Phase 8/16, généralisé en
    // helper partagé).
    await closeAppSafely(app, async () => {
      await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  async function loginAs(farmId: string, roleId: string, password: string): Promise<string> {
    const { id, email } = await createActiveUser(prisma, passwordService, farmId, roleId, password);
    createdUserIds.push(id);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password })
      .expect(200);
    return body<LoginResponseBody>(res).accessToken!;
  }

  let ownerAToken: string;
  let supplierAId: string;

  beforeAll(async () => {
    ownerAToken = await loginAs(farmA.id, proprietaireRoleId, 'OwnerSupplierTest!2026');
  });

  it('crée un fournisseur sur sa ferme (category = texte libre, pas un enum)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        name: 'Fournisseur Aliment SARL',
        category: 'aliment_volaille',
        phone: '+236 70 00 00 00',
      })
      .expect(201);
    const supplier = body<SupplierResponseBody>(res);
    expect(supplier.farmId).toBe(farmA.id);
    expect(supplier.category).toBe('aliment_volaille');
    supplierAId = supplier.id;
    createdSupplierIds.push(supplierAId);
  });

  it('modifie puis supprime le fournisseur (suppression définitive, tracée par audit log)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/suppliers/${supplierAId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ phone: '+236 70 11 11 11' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/suppliers/${supplierAId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(204);

    const deleted = await prisma.supplier.findUnique({ where: { id: supplierAId } });
    expect(deleted).toBeNull(); // hard delete, pas de deletedAt

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: 'supplier', entityId: supplierAId, action: 'SUPPLIER_DELETED' },
    });
    expect(auditRows).toHaveLength(1);
    createdSupplierIds.splice(createdSupplierIds.indexOf(supplierAId), 1);
  });

  let customerAId: string;
  let customerACode: string;

  it('crée un client avec un code auto-généré (CLI-xxxxxx)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Restaurant Le Bon Poulet', type: 'RESTAURANT', locality: 'Samba centre' })
      .expect(201);
    const customer = body<CustomerResponseBody>(res);
    expect(customer.farmId).toBe(farmA.id);
    expect(customer.code).toMatch(/^CLI-\d{6}$/);
    customerAId = customer.id;
    customerACode = customer.code;
    createdCustomerIds.push(customerAId);
  });

  it('génère un code différent, monotone, pour un second client de la même ferme', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Client Particulier', type: 'PARTICULIER' })
      .expect(201);
    const customer = body<CustomerResponseBody>(res);
    expect(customer.code).not.toBe(customerACode);
    createdCustomerIds.push(customer.id);
  });

  describe('Isolation farmId croisée — un utilisateur de la ferme B ne voit jamais les données de la ferme A', () => {
    let readerBToken: string;

    beforeAll(async () => {
      readerBToken = await loginAs(farmB.id, lecteurRoleId, 'ReaderBSupplierTest!2026');
    });

    it('GET /customers/:id du client de la ferme A avec un token de la ferme B → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/customers/${customerAId}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(404);
      // Message générique (pas "Client introuvable.") : la ligne existe bel
      // et bien, assertSameFarm refuse volontairement de distinguer
      // "n'existe pas" de "appartient à une autre ferme" pour ne rien
      // révéler à un tenant tiers — même comportement que Buildings en
      // Phase 1 (auth-rbac.e2e-spec.ts).
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('GET /customers (liste) avec le token de la ferme B ne renvoie jamais les clients de la ferme A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(200);
      const ids = body<CustomerResponseBody[]>(res).map((c) => c.id);
      expect(ids).not.toContain(customerAId);
    });

    it('un Lecteur (lecture seule) ne peut pas créer de client — 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${readerBToken}`)
        .send({ name: 'Client refusé', type: 'AUTRE' })
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });
  });
});
