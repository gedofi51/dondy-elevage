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
 * Prévisions finance (Lot 3). GET /treasury/previsions. Couvre : "réalisé"
 * = EXACTEMENT TreasuryService.getSummary() du 1er du mois à aujourd'hui
 * (même définition réelle, jamais dupliquée), cohérence interne de la
 * projection (règle de trois) quand assez de jours sont écoulés dans le
 * mois, état INSUFFISANT explicite sinon, RBAC (TREASURY_READ réutilisée),
 * isolation farmId.
 *
 * daysElapsed dépend du jour du mois où la CI s'exécute (période implicite
 * = mois calendaire courant, pas de paramètre) — les assertions sur
 * `projected` sont donc dérivées de daysElapsed/daysTotal RENVOYÉS par la
 * réponse plutôt que d'une valeur codée en dur, pour rester correctes
 * quel que soit le jour du mois (voir buildTreasuryForecast.spec.ts pour
 * la couverture exhaustive de l'arithmétique à dates fixes).
 */
jest.setTimeout(30_000);

interface WaterPointResponseBody {
  id: string;
}
interface TreasuryForecastBody {
  periodStart: string;
  periodEnd: string;
  daysElapsed: number;
  daysTotal: number;
  dataStatus: 'SUFFISANT' | 'INSUFFISANT';
  realized: { revenueFcfa: number; totalExpensesFcfa: number; netTreasuryFcfa: number };
  projected: {
    revenueFcfa: number;
    totalExpensesFcfa: number;
    grossMarginFcfa: number;
    profitabilityRate: number;
    netTreasuryFcfa: number;
  } | null;
  calculatedAt: string;
}

const FULL_ACCESS_ROLE = 'Propriétaire / Administrateur';
const NO_ACCESS_ROLE = 'Vendeur / Caisse';

describe('Prévisions finance — GET /treasury/previsions (e2e, Lot 3)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let tokenService: TokenService;

  let farmA: { id: string };
  let farmB: { id: string };
  let roleIdByName: Map<string, string>;
  const permissionsByRoleName = new Map(ROLES_CATALOG.map((r) => [r.name, r.permissions]));

  const createdUserIds: string[] = [];
  const createdWaterPointIds: string[] = [];
  const createdSaleIds: string[] = [];
  let ownerUserId: string;
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
    for (const name of [FULL_ACCESS_ROLE, NO_ACCESS_ROLE]) {
      if (!roleIdByName.has(name)) {
        throw new Error(`Rôle "${name}" introuvable — lancer \`npm run db:seed\` avant les tests.`);
      }
    }

    farmA = await prisma.farm.create({
      data: { name: `Ferme Test A (treasury-forecast e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (treasury-forecast e2e ${Date.now()})` },
    });

    const ownerA = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleIdByName.get(FULL_ACCESS_ROLE)!,
      'UnusedPassword!2026',
    );
    ownerUserId = ownerA.id;
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
  });

  afterAll(async () => {
    await closeAppSafely(app, async () => {
      await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });
      await prisma.waterPoint.deleteMany({ where: { id: { in: createdWaterPointIds } } });
      await prisma.expense.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  async function getForecast(token: string): Promise<TreasuryForecastBody> {
    const res = await request(app.getHttpServer())
      .get('/api/v1/treasury/previsions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return body<TreasuryForecastBody>(res);
  }

  it('réalisé = exactement les ventes/dépenses du mois en cours à date, projection cohérente avec daysElapsed/daysTotal', async () => {
    const waterPointRes = await request(app.getHttpServer())
      .post('/api/v1/water-points')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        name: 'Point Eau Prévisions Test',
        initialIndex: 0,
        tariffFcfaPerM3: 500,
        responsibleId: ownerUserId,
      })
      .expect(201);
    const waterPointId = body<WaterPointResponseBody>(waterPointRes).id;
    createdWaterPointIds.push(waterPointId);

    // Vente comptoir aujourd'hui (CA = 10 000, dans le mois en cours).
    const saleRes = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        productType: 'EAU',
        waterPointId,
        date: new Date().toISOString(),
        saleMode: 'UNITE',
        quantity: 20,
        unitPriceFcfa: 500,
        status: 'CONFIRMEE',
      })
      .expect(201);
    createdSaleIds.push(body<{ id: string }>(saleRes).id);

    // Dépense aujourd'hui (4 000).
    await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ date: new Date().toISOString(), category: 'Autres', amountFcfa: 4_000 })
      .expect(201);

    const forecast = await getForecast(ownerTokenA);

    // "Réalisé" = même définition que /treasury/summary, jamais dupliquée.
    expect(forecast.realized.revenueFcfa).toBe(10_000);
    expect(forecast.realized.totalExpensesFcfa).toBe(4_000);
    // Aucun Payment enregistré ici -> netTreasuryFcfa = 0 - 0 - 4000.
    expect(forecast.realized.netTreasuryFcfa).toBe(-4_000);
    expect(forecast.periodStart).toBeTruthy();
    expect(forecast.periodEnd).toBeTruthy();
    expect(forecast.calculatedAt).toBeTruthy();

    if (forecast.dataStatus === 'INSUFFISANT') {
      // Tout début de mois (< 3 jours écoulés) — état explicite, jamais un
      // chiffre inventé.
      expect(forecast.projected).toBeNull();
    } else {
      expect(forecast.projected).not.toBeNull();
      const runRate = forecast.daysTotal / forecast.daysElapsed;
      expect(forecast.projected!.revenueFcfa).toBe(Math.round(10_000 * runRate));
      expect(forecast.projected!.totalExpensesFcfa).toBe(Math.round(4_000 * runRate));
      expect(forecast.projected!.grossMarginFcfa).toBe(
        forecast.projected!.revenueFcfa - forecast.projected!.totalExpensesFcfa,
      );
    }
  });

  it(`${NO_ACCESS_ROLE} : aucune permission TREASURY_READ -> 403`, async () => {
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

    const res = await request(app.getHttpServer())
      .get('/api/v1/treasury/previsions')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it('isolation farmId : le réalisé de la Ferme B ne voit jamais les ventes/dépenses de la Ferme A', async () => {
    const forecastB = await getForecast(ownerTokenB);
    expect(forecastB.realized.revenueFcfa).toBe(0);
    expect(forecastB.realized.totalExpensesFcfa).toBe(0);
  });
});
