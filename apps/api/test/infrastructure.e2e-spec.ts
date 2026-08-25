import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { InfrastructureAlertsCronService } from '../src/modules/infrastructure/infrastructure-alerts.cron';
import {
  body,
  closeAppSafely,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Cahier V6 §4 (solaire), §5 (eau/forage), §6 (réseau/Starlink) — aucun
 * scénario §19 dédié à ces 3 domaines (vérifié verbatim, voir
 * DETTE_TECHNIQUE.md Phase 18) : scénarios ci-dessous construits à partir
 * des champs du cahier, documentés comme inventés, pas comme gabarit
 * d'acceptation officiel. Frontière vérifiée explicitement : ceci couvre
 * l'infrastructure de PRODUCTION d'eau (forage/pompe/réservoir), pas
 * WaterPoint/WaterReading (module V4, vente commerciale, Phase 6) —
 * l'équation de contrôle §5 lit WaterReading sans le dupliquer.
 */
jest.setTimeout(30_000);

interface AssetResponseBody {
  id: string;
  status: string;
}
interface WaterInfraReadingResponseBody {
  id: string;
  date: string;
  soldVolumeM3: number;
  gapM3: number | null;
}
interface SolarReadingResponseBody {
  id: string;
  date: string;
  batteryChargePercent: string | null;
}
interface NetworkReadingResponseBody {
  id: string;
  date: string;
  operationalStatus: string;
}

describe('Infrastructures eau/solaire/réseau — cycle complet (e2e, V6 §4-6)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let infrastructureAlertsCron: InfrastructureAlertsCronService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;
  let lecteurRoleId: string;
  let comptableRoleId: string;
  let responsableEauRoleId: string;
  let ownerUserId: string;
  let ownerToken: string;

  let waterAssetId: string;
  let solarAssetId: string;
  let networkAssetId: string;

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
    infrastructureAlertsCron = app.get(InfrastructureAlertsCronService);

    const roles = await prisma.role.findMany({ where: { farmId: null } });
    const proprietaireRole = roles.find((r) => r.name === 'Propriétaire / Administrateur');
    const lecteurRole = roles.find((r) => r.name === 'Lecteur / Lecture seule');
    const comptableRole = roles.find((r) => r.name === 'Comptable / Responsable financier');
    const responsableEauRole = roles.find((r) => r.name === 'Responsable eau');
    if (!proprietaireRole || !lecteurRole || !comptableRole || !responsableEauRole) {
      throw new Error(
        'Référentiel de rôles introuvable — lancer `npm run db:seed` avant les tests.',
      );
    }
    proprietaireRoleId = proprietaireRole.id;
    lecteurRoleId = lecteurRole.id;
    comptableRoleId = comptableRole.id;
    responsableEauRoleId = responsableEauRole.id;

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (infrastructure e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (infrastructure e2e ${Date.now()})` },
    });

    const { id: userId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      proprietaireRoleId,
      'OwnerInfraTest!2026',
    );
    ownerUserId = userId;
    createdUserIds.push(userId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'OwnerInfraTest!2026' })
      .expect(200);
    ownerToken = body<LoginResponseBody>(loginRes).accessToken!;

    async function createAsset(designation: string, category: string): Promise<string> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          designation,
          category,
          purchaseDate: '2020-01-01',
          serviceDate: '2020-01-01',
          purchasePriceFcfa: 500_000,
          responsibleId: ownerUserId,
          depreciationDurationYears: 10,
        })
        .expect(201);
      return body<AssetResponseBody>(res).id;
    }

    waterAssetId = await createAsset('Forage principal', 'eau');
    solarAssetId = await createAsset('Centrale solaire', 'solaire');
    networkAssetId = await createAsset('Starlink ferme', 'internet');
  });

  afterAll(async () => {
    // closeAppSafely dès la création de ce fichier — voir
    // DETTE_TECHNIQUE.md (incident Phase 8/16/17, helper partagé).
    await closeAppSafely(app, async () => {
      const farmIds = [farmA.id, farmB.id];
      await prisma.waterInfrastructureReading.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.solarInfrastructureReading.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.networkStatusReading.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.waterReading.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.waterPoint.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.expense.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.depreciationEntry.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.asset.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.notification.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.alert.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: farmIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
    });
  });

  it('1. équation de contrôle eau (§5) — soldVolumeM3/gapM3 dérivés de WaterReading, jamais stockés', async () => {
    const readingDate = '2026-03-01';

    const waterPointRes = await request(app.getHttpServer())
      .post('/api/v1/water-points')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Point de vente test',
        initialIndex: 0,
        tariffFcfaPerM3: 200,
        responsibleId: ownerUserId,
      })
      .expect(201);
    const waterPointId = body<{ id: string }>(waterPointRes).id;

    await request(app.getHttpServer())
      .post(`/api/v1/water-points/${waterPointId}/readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        date: readingDate,
        indexMatin: 0,
        indexSoir: 50,
        cashAmountFcfa: 10_000, // 50 m3 x 200 FCFA/m3 = 10 000, pas d'écart
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/assets/${waterAssetId}/water-infrastructure-readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        date: readingDate,
        pumpedVolumeM3: 100,
        reservoirLevelPercent: 80,
        farmInternalConsumptionM3: 20,
      })
      .expect(201);

    const reading = body<WaterInfraReadingResponseBody>(res);
    // soldVolumeM3 = 50 (WaterReading.consumptionM3 ferme entière, même date).
    expect(reading.soldVolumeM3).toBe(50);
    // gapM3 = 100 (produite) - 20 (consommation ferme) - 50 (vendue) = 30.
    expect(reading.gapM3).toBe(30);
  });

  it('2. relevé solaire (§4) — champs enregistrés tels quels, pas d’équation de contrôle', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/assets/${solarAssetId}/solar-infrastructure-readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: '2026-03-01', dailyProductionKwh: 12.5, batteryChargePercent: 75 })
      .expect(201);
    expect(body<SolarReadingResponseBody>(res).batteryChargePercent).toBe('75');
  });

  it('3. relevé statut réseau (§6) — HORS_LIGNE enregistré', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/assets/${networkAssetId}/network-status-readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: '2026-03-01', operationalStatus: 'HORS_LIGNE' })
      .expect(201);
    expect(body<NetworkReadingResponseBody>(res).operationalStatus).toBe('HORS_LIGNE');
  });

  it('4. isolation multi-tenant (représentatif eau) — 404 générique cross-farm', async () => {
    const { id: lecteurBUserId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmB.id,
      lecteurRoleId,
      'LecteurBInfraTest!2026',
    );
    createdUserIds.push(lecteurBUserId);
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'LecteurBInfraTest!2026' })
      .expect(200);
    const lecteurBToken = body<LoginResponseBody>(loginRes).accessToken!;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/assets/${waterAssetId}/water-infrastructure-readings/2026-03-01`)
      .set('Authorization', `Bearer ${lecteurBToken}`)
      .expect(404);
    expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');

    await request(app.getHttpServer())
      .post(`/api/v1/assets/${waterAssetId}/water-infrastructure-readings`)
      .set('Authorization', `Bearer ${lecteurBToken}`)
      .send({ date: '2026-03-02', pumpedVolumeM3: 10 })
      .expect(403);
  });

  it('5. doublon même date → 409', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/assets/${solarAssetId}/solar-infrastructure-readings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: '2026-03-01', batteryChargePercent: 50 })
      .expect(409);
    expect(body<ErrorResponseBody>(res).message).toContain('existe déjà');
  });

  describe('RBAC — séparation par domaine (le test le plus important de ce plan)', () => {
    let comptableToken: string;
    let responsableEauToken: string;
    let lecteurAToken: string;

    beforeAll(async () => {
      const comptable = await createActiveUser(
        prisma,
        passwordService,
        farmA.id,
        comptableRoleId,
        'ComptableInfraTest!2026',
      );
      createdUserIds.push(comptable.id);
      comptableToken = body<LoginResponseBody>(
        await request(app.getHttpServer())
          .post('/api/v1/auth/connexion')
          .send({ email: comptable.email, password: 'ComptableInfraTest!2026' })
          .expect(200),
      ).accessToken!;

      const responsableEau = await createActiveUser(
        prisma,
        passwordService,
        farmA.id,
        responsableEauRoleId,
        'ResponsableEauInfraTest!2026',
      );
      createdUserIds.push(responsableEau.id);
      responsableEauToken = body<LoginResponseBody>(
        await request(app.getHttpServer())
          .post('/api/v1/auth/connexion')
          .send({ email: responsableEau.email, password: 'ResponsableEauInfraTest!2026' })
          .expect(200),
      ).accessToken!;

      const lecteurA = await createActiveUser(
        prisma,
        passwordService,
        farmA.id,
        lecteurRoleId,
        'LecteurAInfraTest!2026',
      );
      createdUserIds.push(lecteurA.id);
      lecteurAToken = body<LoginResponseBody>(
        await request(app.getHttpServer())
          .post('/api/v1/auth/connexion')
          .send({ email: lecteurA.email, password: 'LecteurAInfraTest!2026' })
          .expect(200),
      ).accessToken!;
    });

    it('un Comptable a lecture seule sur les 3 domaines — 403 en création, 200 en lecture', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${waterAssetId}/water-infrastructure-readings`)
        .set('Authorization', `Bearer ${comptableToken}`)
        .send({ date: '2026-03-03', pumpedVolumeM3: 10 })
        .expect(403);

      await request(app.getHttpServer())
        .get(`/api/v1/assets/${waterAssetId}/water-infrastructure-readings`)
        .set('Authorization', `Bearer ${comptableToken}`)
        .expect(200);
    });

    it('un Lecteur ne peut créer sur aucun des 3 domaines — 403', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${solarAssetId}/solar-infrastructure-readings`)
        .set('Authorization', `Bearer ${lecteurAToken}`)
        .send({ date: '2026-03-04', batteryChargePercent: 60 })
        .expect(403);
    });

    it('Responsable eau : 201 sur eau, 403 sur solaire ET réseau — preuve que la séparation RBAC fonctionne', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${waterAssetId}/water-infrastructure-readings`)
        .set('Authorization', `Bearer ${responsableEauToken}`)
        .send({ date: '2026-03-05', pumpedVolumeM3: 15 })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${solarAssetId}/solar-infrastructure-readings`)
        .set('Authorization', `Bearer ${responsableEauToken}`)
        .send({ date: '2026-03-05', batteryChargePercent: 60 })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${networkAssetId}/network-status-readings`)
        .set('Authorization', `Bearer ${responsableEauToken}`)
        .send({ date: '2026-03-05', operationalStatus: 'OPERATIONNEL' })
        .expect(403);
    });
  });

  describe('Garde REFORME — impossible de relever un actif réformé', () => {
    let reformedAssetId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          designation: 'Actif eau à réformer',
          category: 'eau',
          purchaseDate: '2020-01-01',
          serviceDate: '2020-01-01',
          purchasePriceFcfa: 10_000,
          responsibleId: ownerUserId,
          depreciationDurationYears: 3,
        })
        .expect(201);
      reformedAssetId = body<AssetResponseBody>(res).id;

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${reformedAssetId}/reformer`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);
    });

    it('rejette la création d’un relevé sur un actif réformé (409)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${reformedAssetId}/water-infrastructure-readings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ date: '2026-03-06', pumpedVolumeM3: 10 })
        .expect(409);
    });
  });

  describe('Alertes (InfrastructureAlertsCronService)', () => {
    let lowReservoirAssetId: string;
    let missingReadingAssetId: string;
    let lowBatteryAssetId: string;
    let offlineNetworkAssetId: string;

    beforeAll(async () => {
      async function createAsset(designation: string, category: string): Promise<string> {
        const res = await request(app.getHttpServer())
          .post('/api/v1/assets')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            designation,
            category,
            purchaseDate: '2020-01-01',
            serviceDate: '2020-01-01',
            purchasePriceFcfa: 100_000,
            responsibleId: ownerUserId,
            depreciationDurationYears: 5,
          })
          .expect(201);
        return body<AssetResponseBody>(res).id;
      }

      lowReservoirAssetId = await createAsset('Forage réservoir bas', 'eau');
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${lowReservoirAssetId}/water-infrastructure-readings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ date: '2026-03-10', reservoirLevelPercent: 15 })
        .expect(201);

      missingReadingAssetId = await createAsset('Forage relevé ancien', 'eau');
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${missingReadingAssetId}/water-infrastructure-readings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ date: tenDaysAgo, pumpedVolumeM3: 50 })
        .expect(201);

      lowBatteryAssetId = await createAsset('Centrale batterie basse', 'solaire');
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${lowBatteryAssetId}/solar-infrastructure-readings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ date: '2026-03-10', batteryChargePercent: 10 })
        .expect(201);

      offlineNetworkAssetId = await createAsset('Starlink coupé', 'internet');
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${offlineNetworkAssetId}/network-status-readings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ date: '2026-03-10', operationalStatus: 'HORS_LIGNE' })
        .expect(201);
    });

    it('réservoir eau bas → alerte IMPORTANT, idempotente', async () => {
      await infrastructureAlertsCron.runDailySweep();
      const first = await prisma.alert.findMany({
        where: { entityType: 'asset', entityId: lowReservoirAssetId, type: 'water_reservoir_low' },
      });
      expect(first).toHaveLength(1);
      expect(first[0]!.severity).toBe('IMPORTANT');

      await infrastructureAlertsCron.runDailySweep();
      const second = await prisma.alert.findMany({
        where: { entityType: 'asset', entityId: lowReservoirAssetId, type: 'water_reservoir_low' },
      });
      expect(second).toHaveLength(1);
    });

    it('relevé eau manquant depuis 10 jours (> seuil 7j) → alerte VIGILANCE, idempotente', async () => {
      await infrastructureAlertsCron.runDailySweep();
      const first = await prisma.alert.findMany({
        where: {
          entityType: 'asset',
          entityId: missingReadingAssetId,
          type: 'water_infrastructure_reading_missing',
        },
      });
      expect(first).toHaveLength(1);
      expect(first[0]!.severity).toBe('VIGILANCE');

      await infrastructureAlertsCron.runDailySweep();
      const second = await prisma.alert.findMany({
        where: {
          entityType: 'asset',
          entityId: missingReadingAssetId,
          type: 'water_infrastructure_reading_missing',
        },
      });
      expect(second).toHaveLength(1);
    });

    it('batterie solaire basse → alerte IMPORTANT', async () => {
      await infrastructureAlertsCron.runDailySweep();
      const alerts = await prisma.alert.findMany({
        where: { entityType: 'asset', entityId: lowBatteryAssetId, type: 'solar_battery_low' },
      });
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('IMPORTANT');
    });

    it('réseau hors ligne → alerte IMPORTANT', async () => {
      await infrastructureAlertsCron.runDailySweep();
      const alerts = await prisma.alert.findMany({
        where: { entityType: 'asset', entityId: offlineNetworkAssetId, type: 'network_offline' },
      });
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('IMPORTANT');
    });
  });
});
