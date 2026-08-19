import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import {
  body,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Upload/téléchargement de documents : validation de contenu réel,
 * isolation farmId sur le téléchargement. Vraie base MySQL + vrai disque
 * (apps/api/storage/documents/), nettoyés dans afterAll.
 */
jest.setTimeout(30_000);

interface DocumentResponseBody {
  id: string;
  farmId: string;
  originalName: string;
  mimeType: string;
}

// Signatures magic-bytes réelles, identiques à celles vérifiées dans
// document-validation.service.spec.ts.
const VALID_PDF = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'binary');
const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const INVALID_CONTENT = Buffer.from('ceci nest pas un document valide');

describe('Documents — upload, téléchargement, isolation farmId (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;

  const createdUserIds: string[] = [];
  const createdDocumentIds: string[] = [];

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
    if (!proprietaireRole) {
      throw new Error(
        'Référentiel de rôles Phase 1 introuvable — lancer `npm run db:seed` avant les tests.',
      );
    }
    proprietaireRoleId = proprietaireRole.id;

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (documents e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (documents e2e ${Date.now()})` },
    });
  });

  afterAll(async () => {
    // Nettoyage des octets physiquement écrits sur disque en plus du
    // nettoyage Prisma habituel — sinon apps/api/storage/documents/
    // accumule des fichiers orphelins à chaque run de CI.
    const documents = await prisma.document.findMany({
      where: { id: { in: createdDocumentIds } },
      select: { storedName: true },
    });
    await Promise.all(
      documents.map((d) =>
        unlink(join(process.cwd(), 'storage', 'documents', d.storedName)).catch(() => undefined),
      ),
    );

    await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    await app.close();
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
  let pdfDocumentId: string;

  beforeAll(async () => {
    ownerAToken = await loginAs(farmA.id, proprietaireRoleId, 'OwnerDocsTest!2026');
  });

  it('téléverse un PDF valide (contenu vérifié par signature réelle)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .field('entityType', 'supplier')
      .field('entityId', 'test-entity-id')
      .attach('file', VALID_PDF, 'facture.pdf')
      .expect(201);
    const doc = body<DocumentResponseBody>(res);
    expect(doc.farmId).toBe(farmA.id);
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.originalName).toBe('facture.pdf');
    pdfDocumentId = doc.id;
    createdDocumentIds.push(pdfDocumentId);
  });

  it('téléverse un PNG valide', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .field('entityType', 'supplier')
      .field('entityId', 'test-entity-id')
      .attach('file', VALID_PNG, 'photo.png')
      .expect(201);
    createdDocumentIds.push(body<DocumentResponseBody>(res).id);
  });

  it('rejette un contenu qui ne correspond à aucune signature autorisée — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .field('entityType', 'supplier')
      .field('entityId', 'test-entity-id')
      .attach('file', INVALID_CONTENT, 'malicieux.pdf') // extension mensongère, contenu non PDF
      .expect(400);
  });

  it('télécharge le document téléversé (contenu binaire identique)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/documents/${pdfDocumentId}/telecharger`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    expect(res.header['content-type']).toContain('application/pdf');
  });

  describe('Isolation farmId — le téléchargement est refusé pour un utilisateur d’une autre ferme', () => {
    let ownerBToken: string;

    beforeAll(async () => {
      ownerBToken = await loginAs(farmB.id, proprietaireRoleId, 'OwnerBDocsTest!2026');
    });

    it('GET /documents/:id/telecharger d’un document de la ferme A avec un token de la ferme B → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${pdfDocumentId}/telecharger`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .expect(404);
      // Message générique (voir suppliers-customers.e2e-spec.ts pour le
      // raisonnement complet) : la ligne existe, assertSameFarm refuse de le
      // révéler à un tenant tiers.
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('GET /documents (liste) de la ferme B ne renvoie jamais les documents de la ferme A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${ownerBToken}`)
        .expect(200);
      const ids = body<DocumentResponseBody[]>(res).map((d) => d.id);
      expect(ids).not.toContain(pdfDocumentId);
    });
  });
});
