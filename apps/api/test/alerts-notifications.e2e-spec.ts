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
 * Cycle de vie complet du moteur d'alertes (créée -> déclenchée -> acquittée)
 * + génération de notifications sur alerte IMPORTANT/CRITIQUE, ciblées par
 * permission (ALERTS_ACKNOWLEDGE) et non par nom de rôle en dur.
 */
jest.setTimeout(30_000);

interface AlertResponseBody {
  id: string;
  status: 'CREATED' | 'TRIGGERED' | 'ACKNOWLEDGED';
  severity: string;
  triggeredAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}
interface PaginatedNotifications {
  items: { id: string; alertId: string | null }[];
  total: number;
}

describe('Alerts + Notifications — cycle de vie et ciblage (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  let farmA: { id: string };
  let proprietaireRoleId: string;
  let gerantRoleId: string;
  let employeRoleId: string;

  const createdUserIds: string[] = [];
  const createdAlertIds: string[] = [];

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
    const gerantRole = roles.find((r) => r.name === 'Gérant / Responsable ferme');
    const employeRole = roles.find((r) => r.name === 'Employé');
    if (!proprietaireRole || !gerantRole || !employeRole) {
      throw new Error(
        'Référentiel de rôles Phase 1 introuvable — lancer `npm run db:seed` avant les tests.',
      );
    }
    proprietaireRoleId = proprietaireRole.id;
    gerantRoleId = gerantRole.id;
    employeRoleId = employeRole.id;

    farmA = await prisma.farm.create({ data: { name: `Ferme Test A (alerts e2e ${Date.now()})` } });
  });

  afterAll(async () => {
    // closeAppSafely : app.close() s'exécute même si le nettoyage échoue
    // — voir DETTE_TECHNIQUE.md (incident Phase 8/16, généralisé en
    // helper partagé).
    await closeAppSafely(app, async () => {
      await prisma.notification.deleteMany({ where: { farmId: farmA.id } });
      await prisma.alert.deleteMany({ where: { id: { in: createdAlertIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: farmA.id } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: farmA.id } });
    });
  });

  async function loginAs(
    roleId: string,
    password: string,
  ): Promise<{ token: string; userId: string }> {
    const { id, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleId,
      password,
    );
    createdUserIds.push(id);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password })
      .expect(200);
    return { token: body<LoginResponseBody>(res).accessToken!, userId: id };
  }

  let ownerToken: string;
  let managerUserId: string;
  let employeeUserId: string;

  beforeAll(async () => {
    const owner = await loginAs(proprietaireRoleId, 'OwnerAlertsTest!2026');
    ownerToken = owner.token;
    const manager = await loginAs(gerantRoleId, 'ManagerAlertsTest!2026');
    managerUserId = manager.userId;
    const employee = await loginAs(employeRoleId, 'EmployeeAlertsTest!2026');
    employeeUserId = employee.userId;
  });

  let critiqueAlertId: string;

  it('crée une alerte CRITIQUE sans scheduledAt → déclenchement direct (statut TRIGGERED)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/alerts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'tache_en_retard', severity: 'CRITIQUE', title: 'Vaccination en retard' })
      .expect(201);
    const alert = body<AlertResponseBody>(res);
    expect(alert.status).toBe('TRIGGERED');
    expect(alert.triggeredAt).not.toBeNull();
    critiqueAlertId = alert.id;
    createdAlertIds.push(critiqueAlertId);
  });

  it('génère une notification pour Propriétaire et Gérant (permission ALERTS_ACKNOWLEDGE), jamais pour Employé', async () => {
    const notifiedUserIds = (
      await prisma.notification.findMany({
        where: { alertId: critiqueAlertId },
        select: { userId: true },
      })
    ).map((n) => n.userId);

    expect(notifiedUserIds).toContain(managerUserId);
    expect(notifiedUserIds).not.toContain(employeeUserId);
  });

  it('le Gérant voit la notification via GET /notifications (endpoint self-scopé)', async () => {
    const manager = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({
        email: (await prisma.user.findUniqueOrThrow({ where: { id: managerUserId } })).email,
        password: 'ManagerAlertsTest!2026',
      })
      .expect(200);
    const managerToken = body<LoginResponseBody>(manager).accessToken!;

    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    const page = body<PaginatedNotifications>(res);
    expect(page.items.some((n) => n.alertId === critiqueAlertId)).toBe(true);
  });

  it('une alerte INFO (sévérité non notifiée) ne génère aucune notification', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/alerts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'tache_en_retard', severity: 'INFO', title: 'Info mineure' })
      .expect(201);
    const alert = body<AlertResponseBody>(res);
    createdAlertIds.push(alert.id);

    const count = await prisma.notification.count({ where: { alertId: alert.id } });
    expect(count).toBe(0);
  });

  it("acquitte l'alerte CRITIQUE déclenchée → statut ACKNOWLEDGED + AuditLog", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/alerts/${critiqueAlertId}/acquitter`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const acknowledged = body<AlertResponseBody>(res);
    expect(acknowledged.status).toBe('ACKNOWLEDGED');
    expect(acknowledged.acknowledgedAt).not.toBeNull();

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: 'alert', entityId: critiqueAlertId, action: 'ALERT_ACKNOWLEDGED' },
    });
    expect(auditRows).toHaveLength(1);
  });

  it('rejette un second acquittement (ACKNOWLEDGED -> ACKNOWLEDGED, transition invalide) — 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/alerts/${critiqueAlertId}/acquitter`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);
  });

  describe('Cycle de vie complet avec déclenchement différé', () => {
    let scheduledAlertId: string;

    it('crée une alerte avec scheduledAt futur → reste en CREATED (pas de déclenchement direct)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'tache_en_retard',
          severity: 'VIGILANCE',
          title: 'Tâche planifiée',
          scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
        })
        .expect(201);
      const alert = body<AlertResponseBody>(res);
      expect(alert.status).toBe('CREATED');
      scheduledAlertId = alert.id;
      createdAlertIds.push(scheduledAlertId);
    });

    it('rejette un acquittement direct sur une alerte encore CREATED (saut d’étape) — 409', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/alerts/${scheduledAlertId}/acquitter`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);
    });

    it('déclenche manuellement l’alerte (CREATED -> TRIGGERED) puis l’acquitte (TRIGGERED -> ACKNOWLEDGED)', async () => {
      const triggerRes = await request(app.getHttpServer())
        .post(`/api/v1/alerts/${scheduledAlertId}/declencher`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);
      expect(body<AlertResponseBody>(triggerRes).status).toBe('TRIGGERED');

      const ackRes = await request(app.getHttpServer())
        .post(`/api/v1/alerts/${scheduledAlertId}/acquitter`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);
      expect(body<AlertResponseBody>(ackRes).status).toBe('ACKNOWLEDGED');
    });
  });

  it('liste les alertes de la ferme, paginée, filtrable par statut', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/alerts')
      .query({ status: 'ACKNOWLEDGED', limit: 10, offset: 0 })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const page = body<{ items: AlertResponseBody[]; total: number; limit: number }>(res);
    expect(page.limit).toBe(10);
    expect(page.items.every((a) => a.status === 'ACKNOWLEDGED')).toBe(true);
  });

  it('refuse la création d’alerte sans permission ALERTS_CREATE (Lecteur) — 403', async () => {
    const roles = await prisma.role.findMany({ where: { farmId: null } });
    const lecteurRole = roles.find((r) => r.name === 'Lecteur / Lecture seule')!;
    const reader = await loginAs(lecteurRole.id, 'ReaderAlertsTest!2026');
    const res = await request(app.getHttpServer())
      .post('/api/v1/alerts')
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ type: 'tache_en_retard', severity: 'INFO', title: 'Refusé' })
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });
});
