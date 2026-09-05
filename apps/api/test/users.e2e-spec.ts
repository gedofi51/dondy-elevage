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
 * Écran Utilisateurs (Administration). Couvre : création = invitation
 * (aucun mot de passe accepté/renvoyé, voir CreateUserDto — investigation
 * préalable), liste scopée farmId, changement de rôle, activation/
 * désactivation via `status`, les 2 garde-fous métier (auto-désactivation,
 * dernier utilisateur actif avec USERS_UPDATE), RBAC (Propriétaire complet,
 * Vendeur/Caisse sans accès), isolation farmId.
 */
jest.setTimeout(30_000);

interface RoleResponseBody {
  id: string;
  name: string;
}
interface PublicUserResponseBody {
  id: string;
  farmId: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
  userRoles: Array<{ role: { id: string; name: string } }>;
}
interface ErrorBody {
  message: string | string[];
}

const FULL_ACCESS_ROLE = 'Propriétaire / Administrateur';
const NO_ACCESS_ROLE = 'Vendeur / Caisse';
const NO_ADMIN_RIGHTS_ROLE = 'Employé';

describe('Utilisateurs — CRUD, invitation, garde-fous (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let tokenService: TokenService;

  let farmA: { id: string };
  let farmB: { id: string };
  let roleIdByName: Map<string, string>;
  const permissionsByRoleName = new Map(ROLES_CATALOG.map((r) => [r.name, r.permissions]));

  const createdUserIds: string[] = [];
  let ownerAId: string;
  let ownerBId: string;
  let ownerTokenA: string;
  let ownerTokenB: string;

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
    for (const name of [FULL_ACCESS_ROLE, NO_ACCESS_ROLE, NO_ADMIN_RIGHTS_ROLE]) {
      if (!roleIdByName.has(name)) {
        throw new Error(`Rôle "${name}" introuvable — lancer \`npm run db:seed\` avant les tests.`);
      }
    }

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (users e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (users e2e ${Date.now()})` },
    });

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
    ownerBId = ownerB.id;
    createdUserIds.push(ownerB.id);
    ownerTokenB = tokenService.signAccessToken({
      sub: ownerB.id,
      farmId: farmB.id,
      roles: [FULL_ACCESS_ROLE],
      permissions: permissionsByRoleName.get(FULL_ACCESS_ROLE)!,
    });
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  it('GET /roles renvoie le catalogue des 11 rôles système', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);
    const roles = body<RoleResponseBody[]>(res);
    expect(roles.length).toBe(ROLES_CATALOG.length);
    expect(roles.some((r) => r.name === FULL_ACCESS_ROLE)).toBe(true);
  });

  it('POST /users crée un compte INVITED — invitation par email, jamais de mot de passe saisi par l’admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        email: `nouvel-utilisateur-${Date.now()}@test.local`,
        name: 'Nouvel Utilisateur',
        roleIds: [roleIdByName.get(NO_ADMIN_RIGHTS_ROLE)!],
      })
      .expect(201);
    const created = body<PublicUserResponseBody>(res);
    createdUserIds.push(created.id);

    expect(created.status).toBe('INVITED');
    expect(created).not.toHaveProperty('password');
    expect(created).not.toHaveProperty('passwordHash');
    expect(created.userRoles.map((ur) => ur.role.name)).toEqual([NO_ADMIN_RIGHTS_ROLE]);

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(dbUser.passwordHash).toBeNull(); // aucun mot de passe défini avant activation.
    expect(dbUser.emailVerificationTokenHash).not.toBeNull(); // lien d'invitation émis.
  });

  it('POST /users rejette un champ "password" (whitelist stricte, ValidationPipe) — le contrat n’accepte QUE l’invitation par email', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        email: `avec-mdp-${Date.now()}@test.local`,
        name: 'Avec Mot De Passe',
        roleIds: [roleIdByName.get(NO_ADMIN_RIGHTS_ROLE)!],
        password: 'CeciNeDevraitPasEtreAccepte!2026',
      })
      .expect(400);
    expect(body<ErrorBody>(res).message).toEqual(
      expect.arrayContaining([expect.stringContaining('password')]),
    );
  });

  it('GET /users liste uniquement les utilisateurs de la ferme de l’acteur', async () => {
    const resA = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);
    const usersA = body<PublicUserResponseBody[]>(resA);
    expect(usersA.every((u) => u.farmId === farmA.id)).toBe(true);
    expect(usersA.some((u) => u.id === ownerAId)).toBe(true);
  });

  it('PATCH /users/:id change le rôle et le statut d’un autre utilisateur', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        email: `a-modifier-${Date.now()}@test.local`,
        name: 'À Modifier',
        roleIds: [roleIdByName.get(NO_ADMIN_RIGHTS_ROLE)!],
      })
      .expect(201);
    const targetId = body<PublicUserResponseBody>(createRes).id;
    createdUserIds.push(targetId);

    // Un compte INVITED n'est jamais ACTIVE -> le active manuellement pour
    // tester la désactivation réelle (scénario "employé déjà opérationnel").
    await prisma.user.update({ where: { id: targetId }, data: { status: 'ACTIVE' } });

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/users/${targetId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ status: 'INACTIVE', roleIds: [roleIdByName.get(NO_ACCESS_ROLE)!] })
      .expect(200);
    const updated = body<PublicUserResponseBody>(updateRes);
    expect(updated.status).toBe('INACTIVE');
    expect(updated.userRoles.map((ur) => ur.role.name)).toEqual([NO_ACCESS_ROLE]);
  });

  it('garde-fou : un utilisateur ne peut pas se désactiver lui-même', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/users/${ownerAId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ status: 'INACTIVE' })
      .expect(409);
    expect(body<ErrorBody>(res).message).toContain('désactiver votre propre compte');
  });

  it('garde-fou : impossible de désactiver le dernier utilisateur actif avec des droits d’administration (USERS_UPDATE)', async () => {
    // Ferme B : ownerB est le SEUL utilisateur ACTIF avec USERS_UPDATE.
    // actorB obtient la permission USERS_UPDATE uniquement via son TOKEN
    // (même principe que le test RBAC "aucune permission" ci-dessous — le
    // token est la seule source de vérité pour PermissionsGuard), sans
    // l'avoir réellement en base : il peut donc appeler la route sans
    // être lui-même administrateur, et sans être la cible (donc sans
    // déclencher le garde-fou "auto-désactivation" à la place de
    // celui-ci).
    const { id: actorBId } = await createActiveUser(
      prisma,
      passwordService,
      farmB.id,
      roleIdByName.get(NO_ADMIN_RIGHTS_ROLE)!,
      'UnusedPassword!2026',
    );
    createdUserIds.push(actorBId);
    const actorBToken = tokenService.signAccessToken({
      sub: actorBId,
      farmId: farmB.id,
      roles: [FULL_ACCESS_ROLE],
      permissions: permissionsByRoleName.get(FULL_ACCESS_ROLE)!,
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/users/${ownerBId}`)
      .set('Authorization', `Bearer ${actorBToken}`)
      .send({ status: 'INACTIVE' })
      .expect(409);
    expect(body<ErrorBody>(res).message).toContain('dernier utilisateur actif');
  });

  it(`${NO_ACCESS_ROLE} : aucune permission USERS_* -> 403 sur GET/POST /users`, async () => {
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
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body<ErrorResponseBody>(listRes).message).toContain('Permissions insuffisantes');

    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'x@test.local', name: 'X', roleIds: [roleIdByName.get(NO_ACCESS_ROLE)!] })
      .expect(403);
  });

  it('isolation farmId : un Propriétaire ne peut ni lire ni modifier un utilisateur d’une autre ferme (404)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/users/${ownerAId}`)
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${ownerAId}`)
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({ name: 'Tentative Ferme B' })
      .expect(404);
  });
});
