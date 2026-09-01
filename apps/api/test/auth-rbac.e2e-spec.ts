import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { authenticator } from 'otplib';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { hashOpaqueToken } from '../src/common/security/opaque-token.util';
import { MailService } from '../src/mail/mail.service';
import { closeAppSafely } from './helpers/e2e-test-utils';

/**
 * Test d'intégration contre une vraie base MySQL (pas de mocks) : couvre les
 * points critiques de la Phase 1 — inscription (admin) → activation →
 * connexion → accès protégé → refus si permission insuffisante, isolation
 * stricte farmId cross-tenant, rotation/réutilisation de refresh token, 2FA.
 *
 * Le jeton d'activation en clair n'est jamais récupérable depuis la base
 * (seul son hash est stocké, par design) : on simule la réception de l'email
 * en écrivant nous-mêmes un hash de jeton connu, plutôt que de dépendre de
 * Mailpit être joignable pendant l'exécution des tests.
 *
 * MailService est mocké (overrideProvider) : la création d'utilisateur
 * (POST /users) déclenche un envoi réel via AuthService.issueInvitation(),
 * indépendamment de ce que le test lit ensuite — sans mock, ce test tente
 * une vraie connexion SMTP à chaque exécution, silencieusement absorbée en
 * local (Mailpit y répond) mais en échec (ECONNREFUSED) en CI (aucun SMTP
 * provisionné), source d'un handle de connexion qui ne se referme pas
 * proprement avant la fin du process Jest.
 */
jest.setTimeout(30_000);

interface LoginResponseBody {
  requiresTwoFactor: boolean;
  accessToken?: string;
  refreshToken?: string;
  challengeToken?: string;
}
interface UserResponseBody {
  id: string;
  email: string;
  status: string;
  farmId: string;
}
interface BuildingResponseBody {
  id: string;
  farmId: string;
}
interface ErrorResponseBody {
  message: string;
}
interface EnableTwoFactorResponseBody {
  otpauthUrl: string;
}

function body<T>(res: Response): T {
  return res.body as T;
}

describe('Auth + RBAC + isolation farmId (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  let farmA: { id: string };
  let farmB: { id: string };
  let superAdminRoleId: string;
  let proprietaireRoleId: string;
  let lecteurRoleId: string;

  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        envoyerInvitation: () => Promise.resolve(),
        envoyerReinitialisationMotDePasse: () => Promise.resolve(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);

    const roles = await prisma.role.findMany({ where: { farmId: null } });
    const superAdminRole = roles.find((r) => r.name === 'Super Admin');
    const proprietaireRole = roles.find((r) => r.name === 'Propriétaire / Administrateur');
    const lecteurRole = roles.find((r) => r.name === 'Lecteur / Lecture seule');
    if (!superAdminRole || !proprietaireRole || !lecteurRole) {
      throw new Error(
        'Référentiel de rôles Phase 1 introuvable — lancer `npm run db:seed` avant les tests.',
      );
    }
    superAdminRoleId = superAdminRole.id;
    proprietaireRoleId = proprietaireRole.id;
    lecteurRoleId = lecteurRole.id;

    farmA = await prisma.farm.create({ data: { name: `Ferme Test A (e2e ${Date.now()})` } });
    farmB = await prisma.farm.create({ data: { name: `Ferme Test B (e2e ${Date.now()})` } });
  });

  afterAll(async () => {
    // closeAppSafely : app.close() s'exécute même si le nettoyage échoue
    // — voir DETTE_TECHNIQUE.md (incident Phase 8/16, généralisé en
    // helper partagé).
    await closeAppSafely(app, async () => {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.building.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  async function createActiveUser(
    farmId: string,
    roleId: string,
    passwordPlain: string,
  ): Promise<{ id: string; email: string }> {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
    const user = await prisma.user.create({
      data: {
        farmId,
        email,
        name: 'Utilisateur E2E',
        passwordHash: await passwordService.hash(passwordPlain),
        status: 'ACTIVE',
        emailVerified: true,
        userRoles: { create: { roleId } },
      },
    });
    createdUserIds.push(user.id);
    return { id: user.id, email: user.email };
  }

  let superAdminToken: string;

  it('connecte un compte Super Admin (créé directement, hors invitation)', async () => {
    const { email } = await createActiveUser(farmA.id, superAdminRoleId, 'SuperAdminTest!2026');

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'SuperAdminTest!2026' })
      .expect(200);

    const login = body<LoginResponseBody>(res);
    expect(login.requiresTwoFactor).toBe(false);
    superAdminToken = login.accessToken!;
  });

  let ownerAId: string;
  let ownerAEmail: string;

  it('un admin crée un utilisateur (POST /users) → statut INVITED, mot de passe non défini', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        email: `owner-a-${Date.now()}@test.local`,
        name: 'Propriétaire Ferme A',
        roleIds: [proprietaireRoleId],
        farmId: farmA.id,
      })
      .expect(201);

    const created = body<UserResponseBody>(res);
    expect(created.status).toBe('INVITED');
    ownerAId = created.id;
    ownerAEmail = created.email;
    createdUserIds.push(ownerAId);
  });

  let ownerAToken: string;

  it("active le compte via le jeton d'activation puis se connecte", async () => {
    const plainToken = 'e2e-test-activation-token-123456';
    await prisma.user.update({
      where: { id: ownerAId },
      data: {
        emailVerificationTokenHash: hashOpaqueToken(plainToken),
        emailVerificationExpiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/activer-compte')
      .send({ token: plainToken, password: 'OwnerATest!2026' })
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email: ownerAEmail, password: 'OwnerATest!2026' })
      .expect(200);

    ownerAToken = body<LoginResponseBody>(loginRes).accessToken!;
  });

  it('rejette la connexion avec un mauvais mot de passe (message générique)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email: ownerAEmail, password: 'MauvaisMotDePasse!' })
      .expect(401);
    expect(body<ErrorResponseBody>(res).message).toBe('Email ou mot de passe incorrect.');
  });

  let buildingAId: string;

  it('le Propriétaire (permission buildings.create) peut créer un bâtiment sur sa ferme', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Poulailler 1', type: 'CHAIR', capacity: 500 })
      .expect(201);
    const building = body<BuildingResponseBody>(res);
    buildingAId = building.id;
    expect(building.farmId).toBe(farmA.id);
  });

  it('refuse une action hors permission (créer une ferme sans platform.manage) — 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/farms')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Ferme non autorisée' })
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it('refuse tout accès sans access token — 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/buildings').expect(401);
  });

  describe('Isolation farmId — un utilisateur de la ferme B ne peut jamais accéder aux données de la ferme A', () => {
    let readerBToken: string;

    beforeAll(async () => {
      const { email } = await createActiveUser(farmB.id, lecteurRoleId, 'ReaderBTest!2026');
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email, password: 'ReaderBTest!2026' })
        .expect(200);
      readerBToken = body<LoginResponseBody>(res).accessToken!;
    });

    it('GET /buildings/:id du bâtiment de la ferme A avec un token de la ferme B → 404 générique (pas 403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/buildings/${buildingAId}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('GET /farms/:id de la ferme A avec un token de la ferme B → 404 générique', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/farms/${farmA.id}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(404);
    });

    it('GET /buildings (liste) avec le token de la ferme B ne renvoie que les bâtiments de la ferme B (jamais ceux de la ferme A)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/buildings')
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(200);
      const ids = body<BuildingResponseBody[]>(res).map((b) => b.id);
      expect(ids).not.toContain(buildingAId);
    });
  });

  describe('Rotation et réutilisation du refresh token', () => {
    let refreshToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email: ownerAEmail, password: 'OwnerATest!2026' })
        .expect(200);
      refreshToken = body<LoginResponseBody>(res).refreshToken!;
    });

    it('rafraîchit avec succès et renvoie un nouveau refresh token différent', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/rafraichir')
        .send({ refreshToken })
        .expect(200);
      const newRefreshToken = body<LoginResponseBody>(res).refreshToken!;
      expect(newRefreshToken).not.toBe(refreshToken);
      refreshToken = newRefreshToken; // le nouveau, valide
    });

    it('réutiliser un refresh token déjà tourné (donc révoqué) est rejeté et révoque toute la famille', async () => {
      // refreshToken est maintenant valide (issu du test précédent) ; on le
      // fait tourner une fois de plus pour obtenir un token révoqué à
      // rejouer volontairement.
      const rotated = await request(app.getHttpServer())
        .post('/api/v1/auth/rafraichir')
        .send({ refreshToken })
        .expect(200);
      const newToken = body<LoginResponseBody>(rotated).refreshToken!;

      // Rejouer l'ANCIEN token (refreshToken, déjà révoqué par la rotation
      // ci-dessus) → doit échouer et révoquer toute la famille, y compris newToken.
      await request(app.getHttpServer())
        .post('/api/v1/auth/rafraichir')
        .send({ refreshToken })
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/auth/rafraichir')
        .send({ refreshToken: newToken })
        .expect(401);
    });
  });

  describe('2FA (TOTP)', () => {
    let email: string;
    let token: string;

    beforeAll(async () => {
      const created = await createActiveUser(farmA.id, proprietaireRoleId, 'TwoFaTest!2026');
      email = created.email;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email, password: 'TwoFaTest!2026' })
        .expect(200);
      token = body<LoginResponseBody>(res).accessToken!;
    });

    it('active puis confirme la 2FA avec un vrai code TOTP', async () => {
      const enableRes = await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/activer')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const otpauthUrl = body<EnableTwoFactorResponseBody>(enableRes).otpauthUrl;
      const secretMatch = /secret=([A-Z0-9]+)/.exec(otpauthUrl);
      const secret = secretMatch?.[1];
      if (!secret) {
        throw new Error('Secret 2FA introuvable dans otpauthUrl.');
      }

      const code = authenticator.generate(secret);
      await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/confirmer')
        .set('Authorization', `Bearer ${token}`)
        .send({ code })
        .expect(200);

      // Connexion suivante : mot de passe correct mais 2FA active → challenge, pas de tokens directs.
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email, password: 'TwoFaTest!2026' })
        .expect(200);
      const login = body<LoginResponseBody>(loginRes);
      expect(login.requiresTwoFactor).toBe(true);
      expect(login.accessToken).toBeUndefined();

      const secondCode = authenticator.generate(secret);
      const verifyRes = await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/verifier')
        .send({ challengeToken: login.challengeToken, code: secondCode })
        .expect(200);
      const verified = body<LoginResponseBody>(verifyRes);
      expect(verified.requiresTwoFactor).toBe(false);
      expect(typeof verified.accessToken).toBe('string');
    });
  });
});
