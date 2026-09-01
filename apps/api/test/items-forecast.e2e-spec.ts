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
 * Prévisions stocks (Lot 2, STOCKS.md "Calculer l'autonomie lorsque cela
 * est pertinent") — GET /items/previsions. Couvre : fenêtre glissante de
 * 30 jours (mouvements hors fenêtre ignorés), exclusion des sorties
 * AJUSTEMENT (pas une consommation réelle), état INSUFFISANT explicite
 * (jamais un chiffre inventé) avec repli sur le seuil minimum, RBAC
 * (ITEMS_READ réutilisée, aucune permission dédiée), isolation farmId.
 */
jest.setTimeout(30_000);

interface ItemForecastBody {
  itemId: string;
  status: string;
  dataStatus: 'SUFFISANT' | 'INSUFFISANT';
  windowDays: number;
  movementDaysInWindow: number;
  averageDailyConsumption: number | null;
  autonomyDays: number | null;
  estimatedStockoutDate: string | null;
  suggestedReorderQuantity: number | null;
  reorderBasis: string | null;
  calculatedAt: string;
}
interface ItemResponseBody {
  id: string;
}

const FULL_ACCESS_ROLE = 'Propriétaire / Administrateur';
/** Vendeur/Caisse : aucune permission ITEMS_* (voir roles.catalog.ts) —
 * même rôle "sans accès" que qr-codes.e2e-spec.ts. */
const NO_ACCESS_ROLE = 'Vendeur / Caisse';

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

describe('Prévisions stocks — GET /items/previsions (e2e, Lot 2)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let tokenService: TokenService;

  let farmA: { id: string };
  let farmB: { id: string };
  let roleIdByName: Map<string, string>;
  const permissionsByRoleName = new Map(ROLES_CATALOG.map((r) => [r.name, r.permissions]));

  const createdUserIds: string[] = [];
  const createdItemIds: string[] = [];

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
      data: { name: `Ferme Test A (items-forecast e2e ${Date.now()})` },
    });
    farmB = await prisma.farm.create({
      data: { name: `Ferme Test B (items-forecast e2e ${Date.now()})` },
    });

    const ownerA = await createActiveUser(
      prisma,
      passwordService,
      farmA.id,
      roleIdByName.get(FULL_ACCESS_ROLE)!,
      'UnusedPassword!2026',
    );
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
      await prisma.stockMovement.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.item.deleteMany({ where: { id: { in: createdItemIds } } });
      await prisma.notification.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.alert.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA.id, farmB.id] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
    });
  });

  async function createItem(
    token: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Article Prévisions ${Date.now()}-${Math.random()}`,
        category: 'Test',
        unit: 'kg',
        ...overrides,
      })
      .expect(201);
    const id = body<ItemResponseBody>(res).id;
    createdItemIds.push(id);
    return id;
  }

  async function moveStock(
    token: string,
    itemId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/stock-movements')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId, ...payload })
      .expect(201);
  }

  async function stockUp(token: string, itemId: string, quantity: number): Promise<void> {
    await moveStock(token, itemId, {
      type: 'ENTREE',
      reason: 'PRODUCTION_INTERNE',
      quantity,
      unitCostFcfa: 100,
      date: isoDaysAgo(90),
    });
  }

  async function getForecast(token: string): Promise<ItemForecastBody[]> {
    const res = await request(app.getHttpServer())
      .get('/api/v1/items/previsions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return body<ItemForecastBody[]>(res);
  }

  it('article avec consommation régulière sur 30j -> dataStatus SUFFISANT, autonomie/date/suggestion cohérentes', async () => {
    const itemId = await createItem(ownerTokenA, { minThreshold: 50 });
    await stockUp(ownerTokenA, itemId, 1000);
    // 10 unités/jour sur 5 jours distincts (>= seuil de 3 jours) = 50 sur la fenêtre.
    for (let i = 1; i <= 5; i++) {
      await moveStock(ownerTokenA, itemId, {
        type: 'SORTIE',
        reason: 'CONSOMMATION_INTERNE',
        quantity: 10,
        date: isoDaysAgo(i),
      });
    }

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.itemId === itemId);
    expect(forecast).toBeDefined();
    expect(forecast!.dataStatus).toBe('SUFFISANT');
    expect(forecast!.windowDays).toBe(30);
    expect(forecast!.movementDaysInWindow).toBe(5);
    // 50 / 30 jours = 1.666.../jour
    expect(forecast!.averageDailyConsumption).toBeCloseTo(50 / 30, 5);
    expect(forecast!.autonomyDays).toBeGreaterThan(0);
    expect(forecast!.estimatedStockoutDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(forecast!.calculatedAt).toBeTruthy();
  });

  it('mouvement hors fenêtre (40 jours) ignoré — ne compte pas dans la moyenne', async () => {
    const itemId = await createItem(ownerTokenA);
    await stockUp(ownerTokenA, itemId, 1000);
    await moveStock(ownerTokenA, itemId, {
      type: 'SORTIE',
      reason: 'CONSOMMATION_INTERNE',
      quantity: 500,
      date: isoDaysAgo(40),
    });

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.itemId === itemId);
    expect(forecast!.dataStatus).toBe('INSUFFISANT');
    expect(forecast!.movementDaysInWindow).toBe(0);
  });

  it('sorties AJUSTEMENT exclues de la consommation — n’atteignent jamais le seuil de suffisance', async () => {
    const itemId = await createItem(ownerTokenA);
    await stockUp(ownerTokenA, itemId, 1000);
    for (let i = 1; i <= 5; i++) {
      await moveStock(ownerTokenA, itemId, {
        type: 'SORTIE',
        reason: 'AJUSTEMENT',
        quantity: 20,
        date: isoDaysAgo(i),
        justification: 'Correction inventaire e2e',
      });
    }

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.itemId === itemId);
    expect(forecast!.dataStatus).toBe('INSUFFISANT');
    expect(forecast!.movementDaysInWindow).toBe(0);
  });

  it('donnée insuffisante + stock sous le seuil minimum -> suggestion de repli SEUIL_MINIMUM (jamais un chiffre inventé pour l’autonomie)', async () => {
    const itemId = await createItem(ownerTokenA, { minThreshold: 100 });
    await stockUp(ownerTokenA, itemId, 40);

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.itemId === itemId);
    expect(forecast!.dataStatus).toBe('INSUFFISANT');
    expect(forecast!.averageDailyConsumption).toBeNull();
    expect(forecast!.autonomyDays).toBeNull();
    expect(forecast!.estimatedStockoutDate).toBeNull();
    expect(forecast!.suggestedReorderQuantity).toBe(60);
    expect(forecast!.reorderBasis).toBe('SEUIL_MINIMUM');
  });

  it('donnée insuffisante + stock au-dessus du seuil (ou aucun seuil) -> aucune suggestion', async () => {
    const itemId = await createItem(ownerTokenA);
    await stockUp(ownerTokenA, itemId, 40);

    const forecasts = await getForecast(ownerTokenA);
    const forecast = forecasts.find((f) => f.itemId === itemId);
    expect(forecast!.dataStatus).toBe('INSUFFISANT');
    expect(forecast!.suggestedReorderQuantity).toBeNull();
    expect(forecast!.reorderBasis).toBeNull();
  });

  it(`${NO_ACCESS_ROLE} : aucune permission ITEMS_READ -> 403`, async () => {
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
      .get('/api/v1/items/previsions')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body<ErrorResponseBody>(res).message).toContain('Permissions insuffisantes');
  });

  it('isolation farmId : les prévisions de la Ferme B ne contiennent jamais les articles de la Ferme A', async () => {
    const itemAId = await createItem(ownerTokenA);
    const itemBId = await createItem(ownerTokenB);

    const forecastsA = await getForecast(ownerTokenA);
    const forecastsB = await getForecast(ownerTokenB);

    expect(forecastsA.some((f) => f.itemId === itemAId)).toBe(true);
    expect(forecastsA.some((f) => f.itemId === itemBId)).toBe(false);
    expect(forecastsB.some((f) => f.itemId === itemBId)).toBe(true);
    expect(forecastsB.some((f) => f.itemId === itemAId)).toBe(false);
  });
});
