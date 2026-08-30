import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { MaintenanceAlertsCronService } from '../src/modules/maintenance/maintenance-alerts.cron';
import { MaintenanceTaskGenerationService } from '../src/modules/maintenance/maintenance-task-generation.service';
import {
  body,
  closeAppSafely,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Scénarios d'acceptation V6 §19, rejoués contre une vraie base MySQL (pas
 * de mocks) : "Maintenance pompe à échéance → Tâche créée et responsable
 * alerté" et "Pièce utilisée en réparation → Stock décrémenté et coût
 * imputé à l'actif". Ces deux scénarios sont nettement plus minces que
 * celui de Patrimoine (§19 assets) — une seule phrase de résultat attendu
 * chacun, sans détail exploitable — voir DETTE_TECHNIQUE.md Phase 17.
 * Complété par isolation farmId, RBAC (Propriétaire/Comptable/Lecteur),
 * statut terminal (REALISEE/ANNULEE jamais via PATCH générique), gardes de
 * suppression (activité réelle = MaintenanceIntervention), garde REFORME,
 * et le verrouillage FOR UPDATE de la génération de tâches (décision C.1).
 */
jest.setTimeout(30_000);

interface MaintenancePlanResponseBody {
  id: string;
  assetId: string;
  active: boolean;
  periodicityDays: number;
}
interface MaintenanceTaskResponseBody {
  id: string;
  planId: string | null;
  assetId: string;
  type: string;
  status: string;
  dueDate: string;
  isLate: boolean;
}
interface MaintenanceInterventionResponseBody {
  id: string;
  assetId: string;
  taskId: string | null;
  laborCostFcfa: number;
  partsCostFcfa: number;
  totalCostFcfa: number;
}
interface AssetResponseBody {
  id: string;
  status: string;
  tcoFcfa: number;
}
interface ItemResponseBody {
  id: string;
  currentStock: string;
}

describe('Maintenance — cycle complet (e2e, scénarios V6 §19)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let maintenanceAlertsCron: MaintenanceAlertsCronService;
  let taskGenerationService: MaintenanceTaskGenerationService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;
  let lecteurRoleId: string;
  let comptableRoleId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let pumpAssetId: string;
  let partItemId: string;

  const createdUserIds: string[] = [];

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
    maintenanceAlertsCron = app.get(MaintenanceAlertsCronService);
    taskGenerationService = app.get(MaintenanceTaskGenerationService);

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

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (maintenance e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (maintenance e2e ${Date.now()})` },
    });

    const { id: userId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      proprietaireRoleId,
      'OwnerMaintenanceTest!2026',
    );
    ownerUserId = userId;
    createdUserIds.push(userId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'OwnerMaintenanceTest!2026' })
      .expect(200);
    ownerToken = body<LoginResponseBody>(loginRes).accessToken!;

    const assetRes = await request(app.getHttpServer())
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        designation: 'Pompe forage principale',
        category: 'eau',
        purchaseDate: '2020-01-01',
        serviceDate: '2020-01-01',
        purchasePriceFcfa: 500_000,
        responsibleId: ownerUserId,
        depreciationDurationYears: 10,
      })
      .expect(201);
    pumpAssetId = body<AssetResponseBody>(assetRes).id;

    const itemRes = await request(app.getHttpServer())
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Joint de pompe', category: 'pièces détachées', unit: 'unité' })
      .expect(201);
    partItemId = body<ItemResponseBody>(itemRes).id;

    await request(app.getHttpServer())
      .post('/api/v1/stock-movements')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        itemId: partItemId,
        type: 'ENTREE',
        reason: 'PRODUCTION_INTERNE',
        quantity: 10,
        date: '2026-01-01',
        unitCostFcfa: 5_000,
      })
      .expect(201);
  });

  afterAll(async () => {
    // closeAppSafely : app.close() s'exécute même si le nettoyage échoue —
    // voir DETTE_TECHNIQUE.md (incident Phase 8/16, helper partagé),
    // utilisé dès la création de ce fichier plutôt qu'en réaction à un
    // incident (voir DETTE_TECHNIQUE.md Phase 17).
    await closeAppSafely(app, async () => {
      const farmIds = [farmA.id, farmB.id];
      // Ordre sûr vis-à-vis des FK : dépenses -> mouvements de stock ->
      // interventions -> tâches -> plans -> actifs -> articles -> reste.
      await prisma.expense.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.stockMovement.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.maintenanceIntervention.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.maintenanceTask.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.maintenancePlan.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.depreciationEntry.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.asset.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.item.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.notification.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.alert.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
    });
  });

  let pumpPlanId: string;
  let firstTaskId: string;
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

  it('1. crée un plan de maintenance préventive — 1ère tâche générée immédiatement (dueDate=startDate)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/maintenance-plans')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        assetId: pumpAssetId,
        designation: 'Inspection périodique pompe forage',
        periodicityDays: 90,
        startDate: tenDaysAgo,
      })
      .expect(201);

    const plan = body<MaintenancePlanResponseBody>(res);
    expect(plan.active).toBe(true);
    pumpPlanId = plan.id;

    const tasksRes = await request(app.getHttpServer())
      .get('/api/v1/maintenance-tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const planTasks = body<MaintenanceTaskResponseBody[]>(tasksRes).filter(
      (t) => t.planId === pumpPlanId,
    );
    expect(planTasks).toHaveLength(1);
    expect(planTasks[0]!.type).toBe('PREVENTIVE');
    expect(planTasks[0]!.status).toBe('A_FAIRE');
    expect(new Date(planTasks[0]!.dueDate).toISOString()).toBe(tenDaysAgo);
    expect(planTasks[0]!.isLate).toBe(true);
    firstTaskId = planTasks[0]!.id;
  });

  it('2. scénario §19 « Maintenance pompe à échéance » — alerte IMPORTANT levée (tâche déjà en retard), idempotente', async () => {
    await maintenanceAlertsCron.runDailySweep();

    const alertsAfterFirst = await prisma.alert.findMany({
      where: { entityType: 'maintenance_task', entityId: firstTaskId },
    });
    expect(alertsAfterFirst).toHaveLength(1);
    expect(alertsAfterFirst[0]!.type).toBe('maintenance_task_overdue');
    expect(alertsAfterFirst[0]!.severity).toBe('IMPORTANT');

    await maintenanceAlertsCron.runDailySweep();
    const alertsAfterSecond = await prisma.alert.findMany({
      where: { entityType: 'maintenance_task', entityId: firstTaskId },
    });
    expect(alertsAfterSecond).toHaveLength(1);
  });

  it('2bis. alerte VIGILANCE (échéance proche, sous le délai de préavis) sur une tâche conditionnelle', async () => {
    const dueSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/v1/maintenance-tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        assetId: pumpAssetId,
        type: 'CONDITIONNELLE',
        designation: 'Contrôle vibrations anormales signalées',
        dueDate: dueSoon,
      })
      .expect(201);
    const dueSoonTaskId = body<MaintenanceTaskResponseBody>(res).id;

    await maintenanceAlertsCron.runDailySweep();
    const alerts = await prisma.alert.findMany({
      where: { entityType: 'maintenance_task', entityId: dueSoonTaskId },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe('maintenance_task_due_soon');
    expect(alerts[0]!.severity).toBe('VIGILANCE');
  });

  it('3. scénario §19 « Pièce utilisée en réparation » — stock décrémenté, coût imputé à l’actif, tâche suivante générée', async () => {
    const interventionDate = new Date().toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/v1/maintenance-interventions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        assetId: pumpAssetId,
        taskId: firstTaskId,
        interventionDate,
        diagnosis: 'Fuite au joint',
        laborCostFcfa: 15_000,
        performedBy: 'Technicien local',
        parts: [{ itemId: partItemId, quantity: 2 }],
      })
      .expect(201);

    const intervention = body<MaintenanceInterventionResponseBody>(res);
    expect(intervention.partsCostFcfa).toBe(10_000); // 2 x 5 000 FCFA (CUMP)
    expect(intervention.totalCostFcfa).toBe(25_000); // 15 000 main-d'œuvre + 10 000 pièces

    // Stock décrémenté (10 - 2 = 8).
    const itemRes = await request(app.getHttpServer())
      .get(`/api/v1/items/${partItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Number(body<ItemResponseBody>(itemRes).currentStock)).toBe(8);

    // Coût imputé à l'actif — TCO = acquisition (500 000) + intervention (25 000).
    const assetRes = await request(app.getHttpServer())
      .get(`/api/v1/assets/${pumpAssetId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<AssetResponseBody>(assetRes).tcoFcfa).toBe(525_000);

    // La tâche liée est passée à REALISEE...
    const taskRes = await request(app.getHttpServer())
      .get(`/api/v1/maintenance-tasks/${firstTaskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<MaintenanceTaskResponseBody>(taskRes).status).toBe('REALISEE');

    // ...et la tâche suivante a été générée immédiatement (même requête,
    // pas différée au cron — voir DETTE_TECHNIQUE.md Phase 17, décision C.1).
    const tasksRes = await request(app.getHttpServer())
      .get('/api/v1/maintenance-tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const planTasks = body<MaintenanceTaskResponseBody[]>(tasksRes).filter(
      (t) => t.planId === pumpPlanId,
    );
    expect(planTasks).toHaveLength(2);
    const nextTask = planTasks.find((t) => t.status === 'A_FAIRE')!;
    expect(nextTask).toBeDefined();
    const expectedNextDueDate = new Date(
      new Date(interventionDate).getTime() + 90 * 24 * 60 * 60 * 1000,
    );
    expect(new Date(nextTask.dueDate).toISOString().slice(0, 10)).toBe(
      expectedNextDueDate.toISOString().slice(0, 10),
    );
  });

  it('4. isolation multi-tenant — GET /maintenance-plans/:id de la ferme A avec un token de la ferme B → 404 générique', async () => {
    const { id: lecteurBUserId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmB.id,
      lecteurRoleId,
      'LecteurBMaintenanceTest!2026',
    );
    createdUserIds.push(lecteurBUserId);
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'LecteurBMaintenanceTest!2026' })
      .expect(200);
    const lecteurBToken = body<LoginResponseBody>(loginRes).accessToken!;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/maintenance-plans/${pumpPlanId}`)
      .set('Authorization', `Bearer ${lecteurBToken}`)
      .expect(404);
    expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');

    await request(app.getHttpServer())
      .post('/api/v1/maintenance-plans')
      .set('Authorization', `Bearer ${lecteurBToken}`)
      .send({
        assetId: pumpAssetId,
        designation: 'Interdit',
        periodicityDays: 30,
        startDate: '2026-01-01',
      })
      .expect(403);
  });

  describe('RBAC — Comptable vs Lecteur', () => {
    let comptableAToken: string;
    let comptableTaskId: string;

    beforeAll(async () => {
      const { id: comptableUserId, email } = await createActiveUser(
        prisma,
        passwordService,
        farmA.id,
        comptableRoleId,
        'ComptableMaintenanceTest!2026',
      );
      createdUserIds.push(comptableUserId);
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email, password: 'ComptableMaintenanceTest!2026' })
        .expect(200);
      comptableAToken = body<LoginResponseBody>(loginRes).accessToken!;
    });

    it('un Comptable peut créer/modifier une tâche corrective (mandat financier)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/maintenance-tasks')
        .set('Authorization', `Bearer ${comptableAToken}`)
        .send({
          assetId: pumpAssetId,
          type: 'CORRECTIVE',
          designation: 'Tâche Comptable',
          dueDate: '2026-12-31',
        })
        .expect(201);
      comptableTaskId = body<MaintenanceTaskResponseBody>(createRes).id;

      await request(app.getHttpServer())
        .patch(`/api/v1/maintenance-tasks/${comptableTaskId}`)
        .set('Authorization', `Bearer ${comptableAToken}`)
        .send({ designation: 'Tâche Comptable modifiée' })
        .expect(200);
    });

    it('un Comptable ne peut PAS supprimer une tâche — 403 (même profil que ASSETS_DELETE, absent)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/maintenance-tasks/${comptableTaskId}`)
        .set('Authorization', `Bearer ${comptableAToken}`)
        .expect(403);
    });

    it('un Comptable peut annuler une tâche — MAINTENANCE_TASKS_CANCEL aligné sur ASSETS_REFORM', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/maintenance-tasks/${comptableTaskId}/annuler`)
        .set('Authorization', `Bearer ${comptableAToken}`)
        .send({ cancelReason: 'Test RBAC' })
        .expect(201);
      expect(body<MaintenanceTaskResponseBody>(res).status).toBe('ANNULEE');
    });

    it('un Lecteur ne peut ni créer ni annuler une tâche — 403', async () => {
      const { id: lecteurUserId, email } = await createActiveUser(
        prisma,
        passwordService,
        farmA.id,
        lecteurRoleId,
        'LecteurAMaintenanceTest!2026',
      );
      createdUserIds.push(lecteurUserId);
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email, password: 'LecteurAMaintenanceTest!2026' })
        .expect(200);
      const lecteurToken = body<LoginResponseBody>(loginRes).accessToken!;

      await request(app.getHttpServer())
        .post('/api/v1/maintenance-tasks')
        .set('Authorization', `Bearer ${lecteurToken}`)
        .send({
          assetId: pumpAssetId,
          type: 'CORRECTIVE',
          designation: 'Interdit',
          dueDate: '2026-12-31',
        })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/v1/maintenance-tasks/${comptableTaskId}/annuler`)
        .set('Authorization', `Bearer ${lecteurToken}`)
        .expect(403);
    });
  });

  it('5. le PATCH générique rejette status=REALISEE (400) — seul une intervention ou /annuler y mène', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/maintenance-tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        assetId: pumpAssetId,
        type: 'CORRECTIVE',
        designation: 'Tâche pour test PATCH',
        dueDate: '2026-12-31',
      })
      .expect(201);
    const taskId = body<MaintenanceTaskResponseBody>(res).id;

    await request(app.getHttpServer())
      .patch(`/api/v1/maintenance-tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'REALISEE' })
      .expect(400);
  });

  describe('Garde de suppression — activité réelle (MaintenanceIntervention)', () => {
    let taskWithInterventionId: string;
    let deletableTaskId: string;
    let deletablePlanId: string;

    beforeAll(async () => {
      const taskRes = await request(app.getHttpServer())
        .post('/api/v1/maintenance-tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: pumpAssetId,
          type: 'CORRECTIVE',
          designation: 'Tâche avec intervention liée',
          dueDate: '2026-12-31',
        })
        .expect(201);
      taskWithInterventionId = body<MaintenanceTaskResponseBody>(taskRes).id;

      await request(app.getHttpServer())
        .post('/api/v1/maintenance-interventions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: pumpAssetId,
          taskId: taskWithInterventionId,
          interventionDate: '2026-06-01',
          laborCostFcfa: 1_000,
        })
        .expect(201);

      const deletableTaskRes = await request(app.getHttpServer())
        .post('/api/v1/maintenance-tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: pumpAssetId,
          type: 'CORRECTIVE',
          designation: 'Tâche à supprimer',
          dueDate: '2026-12-31',
        })
        .expect(201);
      deletableTaskId = body<MaintenanceTaskResponseBody>(deletableTaskRes).id;

      const deletablePlanRes = await request(app.getHttpServer())
        .post('/api/v1/maintenance-plans')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: pumpAssetId,
          designation: 'Plan à supprimer',
          periodicityDays: 365,
          startDate: '2027-01-01',
        })
        .expect(201);
      deletablePlanId = body<MaintenancePlanResponseBody>(deletablePlanRes).id;
    });

    it('bloque la suppression (409) d’une tâche avec une intervention rattachée', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/maintenance-tasks/${taskWithInterventionId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);
      expect(body<ErrorResponseBody>(res).message).toContain('intervention');
    });

    it('autorise la suppression d’une tâche sans intervention (204)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/maintenance-tasks/${deletableTaskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
      const remaining = await prisma.maintenanceTask.findUnique({
        where: { id: deletableTaskId },
      });
      expect(remaining).toBeNull();
    });

    it('autorise la suppression d’un plan sans intervention — sa tâche placeholder est supprimée en cascade', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/maintenance-plans/${deletablePlanId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
      const remainingTasks = await prisma.maintenanceTask.findMany({
        where: { planId: deletablePlanId },
      });
      expect(remainingTasks).toHaveLength(0);
    });

    it('bloque la suppression (409) du plan principal — sa tâche initiale a une intervention réelle rattachée', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/maintenance-plans/${pumpPlanId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);
      expect(body<ErrorResponseBody>(res).message).toContain('intervention');
    });
  });

  describe('Garde REFORME — impossible de planifier une maintenance sur un actif réformé', () => {
    let reformedAssetId: string;

    beforeAll(async () => {
      const assetRes = await request(app.getHttpServer())
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          designation: 'Actif à réformer',
          category: 'Outillage',
          purchaseDate: '2020-01-01',
          serviceDate: '2020-01-01',
          purchasePriceFcfa: 10_000,
          responsibleId: ownerUserId,
          depreciationDurationYears: 3,
        })
        .expect(201);
      reformedAssetId = body<AssetResponseBody>(assetRes).id;

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${reformedAssetId}/reformer`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);
    });

    it('rejette la création d’un plan sur un actif réformé (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/maintenance-plans')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: reformedAssetId,
          designation: 'Interdit',
          periodicityDays: 30,
          startDate: '2026-01-01',
        })
        .expect(409);
    });

    it('rejette la création d’une tâche manuelle sur un actif réformé (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/maintenance-tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: reformedAssetId,
          type: 'CORRECTIVE',
          designation: 'Interdit',
          dueDate: '2026-12-31',
        })
        .expect(409);
    });

    it('rejette la création d’une intervention sur un actif réformé (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/maintenance-interventions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: reformedAssetId,
          interventionDate: '2026-06-01',
          laborCostFcfa: 1_000,
        })
        .expect(409);
    });
  });

  describe('Concurrence — verrouillage FOR UPDATE (MaintenanceTaskGenerationService)', () => {
    it('deux générations concurrentes pour le même plan ne créent qu’une seule tâche suivante', async () => {
      const planRes = await request(app.getHttpServer())
        .post('/api/v1/maintenance-plans')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: pumpAssetId,
          designation: 'Plan concurrence',
          periodicityDays: 30,
          startDate: '2026-01-01',
        })
        .expect(201);
      const concurrencyPlanId = body<MaintenancePlanResponseBody>(planRes).id;

      // Force artificiellement l'état "aucune tâche ouverte" (contourne le
      // service, qui régénère toujours atomiquement à la clôture — voir
      // décision C.1) pour exposer la fenêtre de course à tester.
      await prisma.maintenanceTask.updateMany({
        where: { planId: concurrencyPlanId },
        data: { status: 'ANNULEE' },
      });

      await Promise.all([
        prisma.$transaction((tx) =>
          taskGenerationService.ensureNextTaskGenerated(tx, concurrencyPlanId),
        ),
        prisma.$transaction((tx) =>
          taskGenerationService.ensureNextTaskGenerated(tx, concurrencyPlanId),
        ),
      ]);

      const openTasks = await prisma.maintenanceTask.findMany({
        where: { planId: concurrencyPlanId, status: 'A_FAIRE' },
      });
      // Le verrouillage SELECT ... FOR UPDATE (même pattern que
      // StockMovementsService) garantit qu'une seule des deux transactions
      // crée effectivement la tâche suivante — jamais deux.
      expect(openTasks).toHaveLength(1);
    });
  });

  describe('Concurrence — verrou MaintenanceTask, 7e occurrence du défaut Phase 8 (Phase 20)', () => {
    it('deux interventions concurrentes sur la même tâche : une seule aboutit, coût/stock jamais dupliqués', async () => {
      const taskRes = await request(app.getHttpServer())
        .post('/api/v1/maintenance-tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: pumpAssetId,
          type: 'CORRECTIVE',
          designation: 'Tâche concurrence — interventions',
          dueDate: '2026-12-31',
        })
        .expect(201);
      const concurrencyTaskId = body<MaintenanceTaskResponseBody>(taskRes).id;

      const sendIntervention = () =>
        request(app.getHttpServer())
          .post('/api/v1/maintenance-interventions')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            assetId: pumpAssetId,
            taskId: concurrencyTaskId,
            interventionDate: '2026-06-15',
            laborCostFcfa: 1_000,
            parts: [{ itemId: partItemId, quantity: 1 }],
          });

      const [resA, resB] = await Promise.all([sendIntervention(), sendIntervention()]);
      const statuses = [resA.status, resB.status].sort();
      // Ni les deux ne réussissent (double coût/stock), ni les deux
      // n'échouent — exactement une des deux, l'autre un 409 métier propre.
      expect(statuses).toEqual([201, 409]);

      const interventions = await prisma.maintenanceIntervention.findMany({
        where: { taskId: concurrencyTaskId },
      });
      expect(interventions).toHaveLength(1);

      const taskAfter = await request(app.getHttpServer())
        .get(`/api/v1/maintenance-tasks/${concurrencyTaskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(body<MaintenanceTaskResponseBody>(taskAfter).status).toBe('REALISEE');

      const itemRes = await request(app.getHttpServer())
        .get(`/api/v1/items/${partItemId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      // 8 (déjà consommé par le test 3 précédent) - 1 (une seule des deux
      // interventions a effectivement consommé la pièce) = 7.
      expect(Number(body<ItemResponseBody>(itemRes).currentStock)).toBe(7);
    });

    it('une annulation concurrente à une intervention sur la même tâche : état final cohérent, jamais les deux', async () => {
      const taskRes = await request(app.getHttpServer())
        .post('/api/v1/maintenance-tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assetId: pumpAssetId,
          type: 'CORRECTIVE',
          designation: 'Tâche concurrence — annulation vs intervention',
          dueDate: '2026-12-31',
        })
        .expect(201);
      const raceTaskId = body<MaintenanceTaskResponseBody>(taskRes).id;

      const sendIntervention = () =>
        request(app.getHttpServer())
          .post('/api/v1/maintenance-interventions')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            assetId: pumpAssetId,
            taskId: raceTaskId,
            interventionDate: '2026-06-16',
            laborCostFcfa: 500,
          });
      const sendCancel = () =>
        request(app.getHttpServer())
          .post(`/api/v1/maintenance-tasks/${raceTaskId}/annuler`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ cancelReason: 'Test de concurrence' });

      const [resA, resB] = await Promise.all([sendIntervention(), sendCancel()]);
      const statuses = [resA.status, resB.status].sort();
      // .../annuler et POST /maintenance-interventions répondent tous deux
      // 201 par défaut (aucun @HttpCode) — l'un des deux gagne la course.
      expect(statuses).toEqual([201, 409]);

      const taskAfter = await request(app.getHttpServer())
        .get(`/api/v1/maintenance-tasks/${raceTaskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const finalStatus = body<MaintenanceTaskResponseBody>(taskAfter).status;
      const interventions = await prisma.maintenanceIntervention.findMany({
        where: { taskId: raceTaskId },
      });
      // Jamais les deux à la fois : soit REALISEE + 1 intervention, soit
      // ANNULEE + 0 intervention — jamais un état incohérent ni un 500.
      if (finalStatus === 'REALISEE') {
        expect(interventions).toHaveLength(1);
      } else {
        expect(finalStatus).toBe('ANNULEE');
        expect(interventions).toHaveLength(0);
      }
    });
  });
});
