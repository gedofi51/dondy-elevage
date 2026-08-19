import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { BreederAlertsCronService } from '../src/modules/breeder-batches/breeder-alerts.cron';
import {
  body,
  createActiveUser,
  type ErrorResponseBody,
  type LoginResponseBody,
} from './helpers/e2e-test-utils';

/**
 * Scénario d'acceptation V5 §16-D, rejoué de bout en bout contre une vraie
 * base MySQL (pas de mocks) : lot reproducteur (1800 femelles / 200 mâles) →
 * 3 journées de production (1050 œufs sélectionnés pour incubation, exactement
 * le chiffre du cahier) → lot d'incubation (eggCount=1050, égalité stricte
 * avec le disponible — cas limite) → mirage/éclosion (850 poussins) →
 * orientation vers les 4 destinations (chair, renouvellement, vente,
 * réforme/perte) → filiation consultable de bout en bout jusqu'au
 * BreederBatch d'origine.
 *
 * Concurrence : aucun test dédié ici, contrairement à layer-batches.e2e-spec.ts
 * (FIFO œufs, Phase 4). Ce n'est pas un oubli — les vérifications de
 * disponibilité de ce module (IncubationBatchesService.create(), Orientation
 * Service.orient()) sont une lecture agrégée puis comparaison SANS verrou,
 * délibérément reconduites à l'identique du gap déjà connu depuis la Phase 3
 * (SalesService/POULET_CHAIR, jamais testé en concurrence non plus — voir
 * broiler-batches.e2e-spec.ts) plutôt que corrigées ou protégées par un
 * nouveau mécanisme. Voir docs/architecture/DETTE_TECHNIQUE.md, section
 * "Dette transversale". Un test de concurrence n'aurait de sens que pour
 * vérifier une protection réellement introduite — il n'y en a pas ici.
 */
jest.setTimeout(30_000);

const DAY1 = new Date('2026-08-01T00:00:00.000Z');
const DAY2 = new Date('2026-08-02T00:00:00.000Z');
const DAY3 = new Date('2026-08-03T00:00:00.000Z');

interface BreederBatchResponseBody {
  id: string;
  code: string;
  status: string;
  femaleCount: number;
  maleCount: number;
  availableFertileEggs: number;
}
interface DailyRecordResponseBody {
  id: string;
  date: string;
  eggsLaid: number;
  eggsSelectedForIncubation: number;
  eggsRejected: number;
  eggsSold: number;
}
interface IncubatorResponseBody {
  id: string;
  name: string;
}
interface IncubationBatchResponseBody {
  id: string;
  code: string;
  status: string;
  breederBatchId: string;
  eggCount: number;
  chicksHatched: number | null;
  eggsInfertile: number | null;
  eggsInfected: number | null;
  embryonicMortality: number | null;
}
interface BatchLineageResponseBody {
  id: string;
  incubationBatchId: string;
  transformationType: string;
  quantity: number;
  childType: string | null;
  childId: string | null;
  reason: string | null;
}
interface BroilerBatchResponseBody {
  id: string;
  code: string;
  origin: string;
  receivedQuantity: number;
  buildingId: string;
}
interface ChickBatchResponseBody {
  id: string;
  code: string;
  purpose: string;
  initialQuantity: number;
  currentHeadcount: number | null;
}
interface SaleResponseBody {
  id: string;
  saleNumber: string;
  productType: string;
  status: string;
  quantity: number;
  netAmountFcfa: number;
}

describe('Reproduction, couvoir et poussins — cycle complet (e2e, scénario §16-D)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let breederCronService: BreederAlertsCronService;

  let farmA: { id: string };
  let farmB: { id: string };
  let proprietaireRoleId: string;
  let lecteurRoleId: string;
  let buildingId: string;
  let customerId: string;
  let ownerUserId: string;
  let ownerToken: string;

  const createdUserIds: string[] = [];
  const createdBreederBatchIds: string[] = [];
  const createdIncubationBatchIds: string[] = [];
  const createdBroilerBatchIds: string[] = [];
  const createdChickBatchIds: string[] = [];
  const createdIncubatorIds: string[] = [];

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
    breederCronService = app.get(BreederAlertsCronService);

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
      data: { name: `Ferme Test A (breeder e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (breeder e2e ${Date.now()})` },
    });

    const { id: userId, email } = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      proprietaireRoleId,
      'OwnerBreederTest!2026',
    );
    ownerUserId = userId;
    createdUserIds.push(userId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/connexion')
      .send({ email, password: 'OwnerBreederTest!2026' })
      .expect(200);
    ownerToken = body<LoginResponseBody>(loginRes).accessToken!;

    const building = await prisma.building.create({
      data: {
        farmId: farmA.id,
        name: 'Bâtiment Reproduction/Couvoir Test',
        type: 'REPRODUCTION',
        createdBy: ownerUserId,
      },
    });
    buildingId = building.id;

    const customer = await prisma.customer.create({
      data: {
        farmId: farmA.id,
        code: 'CLI-TEST03',
        name: 'Éleveur Poussins Test',
        type: 'REVENDEUR',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    // Ordre sûr vis-à-vis des FK : ventes (chickBatchId) -> filiation
    // (incubationBatchId) -> journées de la bande chair -> lots poussins ->
    // bandes chair -> lots d'incubation -> journées reproducteurs -> lots
    // reproducteurs -> couveuses -> notifications -> alertes -> références ->
    // utilisateurs -> fermes.
    await prisma.sale.deleteMany({ where: { chickBatchId: { in: createdChickBatchIds } } });
    await prisma.batchLineage.deleteMany({
      where: { incubationBatchId: { in: createdIncubationBatchIds } },
    });
    await prisma.broilerDailyRecord.deleteMany({
      where: { batchId: { in: createdBroilerBatchIds } },
    });
    await prisma.chickBatch.deleteMany({ where: { id: { in: createdChickBatchIds } } });
    await prisma.broilerBatch.deleteMany({ where: { id: { in: createdBroilerBatchIds } } });
    await prisma.incubationBatch.deleteMany({ where: { id: { in: createdIncubationBatchIds } } });
    await prisma.breederDailyRecord.deleteMany({
      where: { batchId: { in: createdBreederBatchIds } },
    });
    await prisma.breederBatch.deleteMany({ where: { id: { in: createdBreederBatchIds } } });
    await prisma.incubator.deleteMany({ where: { id: { in: createdIncubatorIds } } });
    await prisma.notification.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    await prisma.alert.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.building.deleteMany({ where: { id: buildingId } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    await app.close();
  });

  let breederBatchId: string;
  let incubatorId: string;
  let incubationBatchId: string;
  let broilerBatchId: string;
  let renewalChickBatchId: string;
  let saleChickBatchId: string;

  it('1. crée un lot reproducteur de 1800 femelles / 200 mâles → code auto REP-AAAA-NNN, 0 œuf fécondé disponible', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/breeder-batches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        constitutionDate: DAY1.toISOString(),
        strain: 'Ross 308',
        femaleCount: 1800,
        maleCount: 200,
        buildingId,
        primaryManagerId: ownerUserId,
      })
      .expect(201);
    const batch = body<BreederBatchResponseBody>(res);
    expect(batch.code).toMatch(/^REP-\d{4}-\d{3}$/);
    expect(batch.availableFertileEggs).toBe(0);
    breederBatchId = batch.id;
    createdBreederBatchIds.push(breederBatchId);
  });

  it('2. saisit 3 journées de production → 1050 œufs sélectionnés pour incubation cumulés (§16-D)', async () => {
    const days = [
      { date: DAY1, eggsLaid: 420, eggsSelectedForIncubation: 380, eggsRejected: 25, eggsSold: 15 },
      { date: DAY2, eggsLaid: 410, eggsSelectedForIncubation: 370, eggsRejected: 20, eggsSold: 20 },
      { date: DAY3, eggsLaid: 400, eggsSelectedForIncubation: 300, eggsRejected: 30, eggsSold: 70 },
    ];
    for (const day of days) {
      // Contrôle arithmétique du scénario lui-même (pas une assertion de test) :
      // sélectionnés + rejetés + vendus doit toujours retomber sur pondus.
      expect(day.eggsSelectedForIncubation + day.eggsRejected + day.eggsSold).toBe(day.eggsLaid);
      const res = await request(app.getHttpServer())
        .post(`/api/v1/breeder-batches/${breederBatchId}/daily-records`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          date: day.date.toISOString(),
          eggsLaid: day.eggsLaid,
          eggsSelectedForIncubation: day.eggsSelectedForIncubation,
          eggsRejected: day.eggsRejected,
          eggsSold: day.eggsSold,
        })
        .expect(201);
      expect(body<DailyRecordResponseBody>(res).eggsLaid).toBe(day.eggsLaid);
    }

    const batchRes = await request(app.getHttpServer())
      .get(`/api/v1/breeder-batches/${breederBatchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    // 380 + 370 + 300 = 1050 (exactement le chiffre §16-D).
    expect(body<BreederBatchResponseBody>(batchRes).availableFertileEggs).toBe(1050);
  });

  it('3. crée une couveuse', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/incubators')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Couveuse Test 1', capacityEggs: 1200 })
      .expect(201);
    incubatorId = body<IncubatorResponseBody>(res).id;
    createdIncubatorIds.push(incubatorId);
  });

  it('4. refuse un lot d’incubation demandant plus d’œufs que le disponible (1051 > 1050) — 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/incubation-batches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        breederBatchId,
        incubatorId,
        incubationStartDate: DAY3.toISOString(),
        eggCount: 1051,
      })
      .expect(409);
    expect(body<ErrorResponseBody>(res).message).toContain('1051');
  });

  it('5. crée un lot d’incubation avec eggCount=1050 → égalité stricte avec le disponible acceptée', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/incubation-batches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        breederBatchId,
        incubatorId,
        incubationStartDate: DAY3.toISOString(),
        eggCount: 1050,
      })
      .expect(201);
    const batch = body<IncubationBatchResponseBody>(res);
    expect(batch.code).toMatch(/^INC-\d{4}-\d{3}$/);
    expect(batch.eggCount).toBe(1050);
    expect(batch.breederBatchId).toBe(breederBatchId);
    incubationBatchId = batch.id;
    createdIncubationBatchIds.push(incubationBatchId);

    // Les 1050 œufs disponibles sont maintenant tous engagés dans ce lot.
    const breederRes = await request(app.getHttpServer())
      .get(`/api/v1/breeder-batches/${breederBatchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<BreederBatchResponseBody>(breederRes).availableFertileEggs).toBe(0);
  });

  it('6. refuse d’orienter des poussins avant la saisie du bilan d’éclosion — 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/incubation-batches/${incubationBatchId}/orientation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ transformationType: 'REFORME_PERTE', quantity: 1, reason: 'test prématuré' })
      .expect(400);
  });

  it('7. saisit le bilan de mirage/éclosion → 130 infertiles, 20 infectés, 50 mortalité embryonnaire, 850 éclos (somme = eggCount)', async () => {
    // 130 + 20 + 50 + 850 = 1050 = eggCount : cohérence parfaite (§16-D).
    expect(130 + 20 + 50 + 850).toBe(1050);
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/incubation-batches/${incubationBatchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        actualHatchDate: new Date('2026-08-24T00:00:00.000Z').toISOString(),
        eggsInfertile: 130,
        eggsInfected: 20,
        embryonicMortality: 50,
        chicksHatched: 850,
        status: 'ECLOS',
      })
      .expect(200);
    const batch = body<IncubationBatchResponseBody>(res);
    expect(batch.chicksHatched).toBe(850);
    expect(batch.status).toBe('ECLOS');
  });

  it('8. oriente 500 poussins vers une nouvelle bande de chair (origin=NAISSANCE_INTERNE)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/incubation-batches/${incubationBatchId}/orientation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        transformationType: 'CHAIR',
        quantity: 500,
        buildingId,
        primaryManagerId: ownerUserId,
      })
      .expect(201);
    const lineage = body<BatchLineageResponseBody>(res);
    expect(lineage.transformationType).toBe('CHAIR');
    expect(lineage.quantity).toBe(500);
    expect(lineage.childType).toBe('broiler_batch');
    broilerBatchId = lineage.childId!;
    createdBroilerBatchIds.push(broilerBatchId);

    const broilerRes = await request(app.getHttpServer())
      .get(`/api/v1/broiler-batches/${broilerBatchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const broilerBatch = body<BroilerBatchResponseBody>(broilerRes);
    expect(broilerBatch.origin).toBe('NAISSANCE_INTERNE');
    expect(broilerBatch.receivedQuantity).toBe(500);
    expect(broilerBatch.buildingId).toBe(buildingId);
  });

  it('9. oriente 300 poussins vers un lot de renouvellement', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/incubation-batches/${incubationBatchId}/orientation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ transformationType: 'RENOUVELLEMENT', quantity: 300, buildingId })
      .expect(201);
    const lineage = body<BatchLineageResponseBody>(res);
    expect(lineage.childType).toBe('chick_batch');
    renewalChickBatchId = lineage.childId!;
    createdChickBatchIds.push(renewalChickBatchId);

    const chickRes = await request(app.getHttpServer())
      .get(`/api/v1/chick-batches/${renewalChickBatchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const chickBatch = body<ChickBatchResponseBody>(chickRes);
    expect(chickBatch.purpose).toBe('RENOUVELLEMENT');
    expect(chickBatch.initialQuantity).toBe(300);
    // Jamais vendu : pas de notion d'effectif "restant à vendre".
    expect(chickBatch.currentHeadcount).toBeNull();
  });

  it('10. oriente 30 poussins vers un lot de vente, puis en vend 20 (productType=POUSSINS)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/incubation-batches/${incubationBatchId}/orientation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ transformationType: 'VENTE', quantity: 30 })
      .expect(201);
    const lineage = body<BatchLineageResponseBody>(res);
    expect(lineage.childType).toBe('chick_batch');
    saleChickBatchId = lineage.childId!;
    createdChickBatchIds.push(saleChickBatchId);

    const beforeRes = await request(app.getHttpServer())
      .get(`/api/v1/chick-batches/${saleChickBatchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<ChickBatchResponseBody>(beforeRes).currentHeadcount).toBe(30);

    const saleRes = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productType: 'POUSSINS',
        chickBatchId: saleChickBatchId,
        date: DAY3.toISOString(),
        customerId,
        saleMode: 'UNITE',
        quantity: 20,
        unitPriceFcfa: 500,
        status: 'CONFIRMEE',
      })
      .expect(201);
    const sale = body<SaleResponseBody>(saleRes);
    expect(sale.productType).toBe('POUSSINS');
    expect(sale.netAmountFcfa).toBe(10_000);

    const afterRes = await request(app.getHttpServer())
      .get(`/api/v1/chick-batches/${saleChickBatchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<ChickBatchResponseBody>(afterRes).currentHeadcount).toBe(10);
  });

  it('11. refuse une vente de poussins supérieure au stock restant du lot (10 disponibles, 15 demandés) — 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productType: 'POUSSINS',
        chickBatchId: saleChickBatchId,
        date: DAY3.toISOString(),
        customerId,
        saleMode: 'UNITE',
        quantity: 15,
        unitPriceFcfa: 500,
        status: 'CONFIRMEE',
      })
      .expect(409);
    expect(body<ErrorResponseBody>(res).message).toContain('10');
  });

  it('12. oriente 15 poussins en réforme/perte (motif requis, aucune entité enfant)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/incubation-batches/${incubationBatchId}/orientation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ transformationType: 'REFORME_PERTE', quantity: 15, reason: 'Poussins chétifs' })
      .expect(201);
    const lineage = body<BatchLineageResponseBody>(res);
    expect(lineage.childType).toBeNull();
    expect(lineage.childId).toBeNull();
    expect(lineage.reason).toBe('Poussins chétifs');
  });

  it('13. refuse d’orienter 10 poussins de plus (5 seulement restent disponibles : 850-500-300-30-15) — 409', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/incubation-batches/${incubationBatchId}/orientation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ transformationType: 'REFORME_PERTE', quantity: 10, reason: 'Test dépassement' })
      .expect(409);
    expect(body<ErrorResponseBody>(res).message).toContain('5');
  });

  it('14. oriente exactement les 5 derniers poussins disponibles, puis refuse toute orientation supplémentaire (0 restant) — 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/incubation-batches/${incubationBatchId}/orientation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ transformationType: 'REFORME_PERTE', quantity: 5, reason: 'Solde du lot' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/incubation-batches/${incubationBatchId}/orientation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ transformationType: 'REFORME_PERTE', quantity: 1, reason: 'Ne devrait pas passer' })
      .expect(409);
  });

  it('15. la filiation est consultable de bout en bout : BroilerBatch (chair) -> BatchLineage -> IncubationBatch -> BreederBatch', async () => {
    const lineageRes = await request(app.getHttpServer())
      .get(`/api/v1/batch-lineage?incubationBatchId=${incubationBatchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const lineageRows = body<BatchLineageResponseBody[]>(lineageRes);
    // CHAIR(500) + RENOUVELLEMENT(300) + VENTE(30) + REFORME_PERTE(15) +
    // REFORME_PERTE(5) = 850 = chicksHatched, en 5 lignes distinctes.
    expect(lineageRows).toHaveLength(5);
    expect(lineageRows.reduce((sum, row) => sum + row.quantity, 0)).toBe(850);

    const chairLineage = lineageRows.find((row) => row.transformationType === 'CHAIR');
    expect(chairLineage?.childType).toBe('broiler_batch');
    expect(chairLineage?.childId).toBe(broilerBatchId);
    expect(chairLineage?.incubationBatchId).toBe(incubationBatchId);

    const incubationRes = await request(app.getHttpServer())
      .get(`/api/v1/incubation-batches/${incubationBatchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<IncubationBatchResponseBody>(incubationRes).breederBatchId).toBe(breederBatchId);

    const breederRes = await request(app.getHttpServer())
      .get(`/api/v1/breeder-batches/${breederBatchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<BreederBatchResponseBody>(breederRes).code).toMatch(/^REP-\d{4}-\d{3}$/);
  });

  it('16. le cron d’alertes reproduction/couvoir s’exécute sans erreur', async () => {
    await expect(breederCronService.runDailySweep()).resolves.toBeUndefined();
  });

  describe('Isolation farmId et RBAC', () => {
    let readerBToken: string;

    beforeAll(async () => {
      const { id, email } = await createActiveUser(
        prisma,
        passwordService,
        farmB.id,
        lecteurRoleId,
        'ReaderBBreederTest!2026',
      );
      createdUserIds.push(id);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/connexion')
        .send({ email, password: 'ReaderBBreederTest!2026' })
        .expect(200);
      readerBToken = body<LoginResponseBody>(res).accessToken!;
    });

    it('GET /breeder-batches/:id d’un lot de la ferme A avec un token de la ferme B → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/breeder-batches/${breederBatchId}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('GET /incubation-batches/:id d’un lot de la ferme A avec un token de la ferme B → 404 générique', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/incubation-batches/${incubationBatchId}`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .expect(404);
      expect(body<ErrorResponseBody>(res).message).toBe('Ressource introuvable.');
    });

    it('un Lecteur (lecture seule) ne peut pas créer de lot reproducteur — 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/breeder-batches')
        .set('Authorization', `Bearer ${readerBToken}`)
        .send({
          constitutionDate: DAY1.toISOString(),
          femaleCount: 100,
          maleCount: 10,
          buildingId,
          primaryManagerId: ownerUserId,
        })
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });

    it('un Lecteur ne peut pas orienter de poussins — 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/incubation-batches/${incubationBatchId}/orientation`)
        .set('Authorization', `Bearer ${readerBToken}`)
        .send({ transformationType: 'REFORME_PERTE', quantity: 1, reason: 'Test RBAC' })
        .expect(403);
      expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
    });
  });
});
