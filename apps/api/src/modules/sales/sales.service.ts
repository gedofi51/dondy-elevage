import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Sale, type SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { BroilerBatchesService } from '../broiler-batches/broiler-batches.service';
import { LayerBatchesService } from '../layer-batches/layer-batches.service';
import { EggStockService } from '../egg-stock/egg-stock.service';
import {
  computeGrossAmountFcfa,
  computeNetAmountFcfa,
} from '../broiler-batches/calculations/broiler-sales.calculations';
import type { CreateSaleDto } from './dto/create-sale.dto';
import type { UpdateSaleDto } from './dto/update-sale.dto';
import type { ListSalesQueryDto } from './dto/list-sales.query.dto';

const NON_COUNTED_STATUSES: SaleStatus[] = ['BROUILLON', 'RESERVEE', 'ANNULEE'];
const PAID_STATUSES: SaleStatus[] = ['PAYEE', 'PARTIELLEMENT_PAYEE'];
const MAX_TRANSACTION_RETRIES = 3;

/** BROUILLON/RESERVEE ne "réservent" rien physiquement — ni l'effectif
 * poulet (BroilerBatchesService.currentHeadcount), ni le stock d'œufs
 * (EggStockLot) ne sont décrémentés avant que le statut n'atteigne ce
 * palier. Même logique appliquée aux deux productType pour rester
 * cohérent : un brouillon ne bloque jamais physiquement une ressource. */
function countsTowardAvailability(status: SaleStatus): boolean {
  return !NON_COUNTED_STATUSES.includes(status);
}

function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly broilerBatchesService: BroilerBatchesService,
    private readonly layerBatchesService: LayerBatchesService,
    private readonly eggStockService: EggStockService,
  ) {}

  /** Dérivé du dernier numéro émis pour la ferme+année (VTE-AAAA-NNN) — un
   * seul registre partagé entre poulets et œufs, pas de séquence par
   * productType (plus simple, cohérent avec "une seule table Sale = un seul
   * registre"). Même principe que BroilerBatchesService.generateBatchCode. */
  private async generateSaleNumber(farmId: string, year: number): Promise<string> {
    const prefix = `VTE-${year}-`;
    const last = await this.prisma.sale.findFirst({
      where: { farmId, saleNumber: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { saleNumber: true },
    });
    const lastNumber = last ? parseInt(/(\d+)$/.exec(last.saleNumber)?.[1] ?? '0', 10) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
  }

  private async assertReferencesBelongToFarm(
    farmId: string,
    refs: { customerId?: string; sellerId?: string; actingUserId: string },
  ): Promise<void> {
    if (refs.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: refs.customerId } });
      if (!customer || customer.farmId !== farmId) {
        throw new NotFoundException('Client introuvable.');
      }
    }
    if (refs.sellerId && refs.sellerId !== refs.actingUserId) {
      const seller = await this.prisma.user.findUnique({ where: { id: refs.sellerId } });
      if (!seller || seller.farmId !== farmId) {
        throw new NotFoundException('Vendeur introuvable.');
      }
    }
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateSaleDto,
    ipAddress: string | null,
  ): Promise<Sale> {
    await this.assertReferencesBelongToFarm(actingUser.farmId, {
      customerId: dto.customerId,
      sellerId: dto.sellerId,
      actingUserId: actingUser.sub,
    });

    const status = dto.status ?? 'BROUILLON';
    const grossAmountFcfa = computeGrossAmountFcfa(dto.quantity, dto.unitPriceFcfa);
    const netAmountFcfa = computeNetAmountFcfa(grossAmountFcfa, dto.discountFcfa ?? 0);
    const saleNumber = await this.generateSaleNumber(
      actingUser.farmId,
      new Date(dto.date).getFullYear(),
    );
    const sellerId = dto.sellerId ?? actingUser.sub;

    const baseData = {
      farmId: actingUser.farmId,
      productType: dto.productType,
      batchId: dto.productType === 'POULET_CHAIR' ? dto.batchId : null,
      layerBatchId: dto.productType === 'OEUFS' ? dto.layerBatchId : null,
      saleNumber,
      date: new Date(dto.date),
      customerId: dto.customerId,
      sellerId,
      saleMode: dto.saleMode,
      quantity: dto.quantity,
      weightKg: dto.weightKg,
      unitPriceFcfa: dto.unitPriceFcfa,
      discountFcfa: dto.discountFcfa ?? 0,
      grossAmountFcfa,
      netAmountFcfa,
      status,
      observation: dto.observation,
      createdBy: actingUser.sub,
    } satisfies Prisma.SaleUncheckedCreateInput;

    let sale: Sale;

    if (dto.productType === 'POULET_CHAIR') {
      if (!dto.batchId) {
        throw new BadRequestException('batchId requis pour une vente de poulets de chair.');
      }
      // §17 : vérifié dès la création (même en brouillon), pas seulement à
      // la confirmation, pour ne jamais laisser promettre plus que
      // l'effectif réel.
      const computedBatch = await this.broilerBatchesService.findOne(actingUser, dto.batchId);
      if (dto.quantity > computedBatch.currentHeadcount) {
        throw new ConflictException(
          `Quantité vendue (${dto.quantity}) supérieure à l'effectif disponible (${computedBatch.currentHeadcount}).`,
        );
      }
      sale = await this.prisma.sale.create({ data: baseData });
    } else {
      if (!dto.layerBatchId) {
        throw new BadRequestException("layerBatchId requis pour une vente d'œufs.");
      }
      // Vérifie l'existence/l'appartenance du lot à la ferme.
      await this.layerBatchesService.findOne(actingUser, dto.layerBatchId);

      if (!countsTowardAvailability(status)) {
        // Brouillon/réservée : aucune consommation physique de stock —
        // création simple, comme pour un poulet de chair en brouillon.
        sale = await this.prisma.sale.create({ data: baseData });
      } else {
        sale = await this.createEggSaleAndConsumeStock(
          actingUser,
          dto.layerBatchId,
          dto.quantity,
          baseData,
        );
      }
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'sale',
      entityId: sale.id,
      action: 'SALE_CREATED',
      newValues: {
        saleNumber,
        productType: dto.productType,
        quantity: dto.quantity,
        netAmountFcfa,
        batchId: dto.batchId,
        layerBatchId: dto.layerBatchId,
      },
      ipAddress,
    });

    return sale;
  }

  /**
   * Crée la vente ET consomme le FIFO du stock d'œufs dans une seule
   * transaction Serializable — sinon un échec de consumeFifo après création
   * de la vente laisserait une vente "fantôme" sans stock derrière elle
   * (EggStockMovement.saleId exige que la vente existe déjà, donc la vente
   * doit être créée AVANT la consommation ; les deux doivent réussir ou
   * échouer ensemble). Retry sur échec de sérialisation (P2034), même
   * idiome que EggStockService.consumeFifo.
   */
  private async createEggSaleAndConsumeStock(
    actingUser: AccessTokenPayload,
    layerBatchId: string,
    quantity: number,
    baseData: Prisma.SaleUncheckedCreateInput,
  ): Promise<Sale> {
    // Pré-vérification rapide (hors transaction) pour un message d'erreur
    // immédiat dans le cas courant non concurrent — la garantie réelle
    // contre la survente reste la transaction Serializable ci-dessous.
    const available = await this.eggStockService.getAvailableQuantity(
      actingUser.farmId,
      layerBatchId,
    );
    if (quantity > available) {
      throw new ConflictException(
        `Quantité vendue (${quantity}) supérieure au stock d'œufs disponible (${available}).`,
      );
    }

    for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const created = await tx.sale.create({ data: baseData });
            await this.eggStockService.consumeFifoInTransaction(
              tx,
              actingUser.farmId,
              layerBatchId,
              quantity,
              created.id,
              actingUser.sub,
            );
            return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof ConflictException) {
          throw error;
        }
        if (isSerializationFailure(error) && attempt < MAX_TRANSACTION_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }
    // Inatteignable (la boucle retourne ou lève systématiquement), requis pour TypeScript.
    throw new ConflictException('Impossible de finaliser la vente — réessayer.');
  }

  async findAll(actingUser: AccessTokenPayload, query: ListSalesQueryDto): Promise<Sale[]> {
    return this.prisma.sale.findMany({
      where: {
        farmId: actingUser.farmId,
        batchId: query.batchId,
        layerBatchId: query.layerBatchId,
        status: query.status,
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Sale> {
    const sale = await this.prisma.sale.findUnique({ where: { id } });
    if (!sale) {
      throw new NotFoundException('Vente introuvable.');
    }
    assertSameFarm(actingUser, sale.farmId);
    return sale;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateSaleDto,
    ipAddress: string | null,
  ): Promise<Sale> {
    const existing = await this.findOne(actingUser, id);
    await this.assertReferencesBelongToFarm(actingUser.farmId, {
      customerId: dto.customerId,
      sellerId: dto.sellerId,
      actingUserId: actingUser.sub,
    });

    const newQuantity = dto.quantity ?? existing.quantity;
    const newStatus = dto.status ?? existing.status;
    const wasCounted = countsTowardAvailability(existing.status);
    const willBeCounted = countsTowardAvailability(newStatus);

    if (existing.productType === 'POULET_CHAIR') {
      if (willBeCounted) {
        const computedBatch = await this.broilerBatchesService.findOne(
          actingUser,
          existing.batchId!,
        );
        // currentHeadcount exclut déjà cette vente si elle comptait avant
        // modification — on la réintègre le temps de la comparaison, sinon
        // on se compare à un effectif qui s'exclut lui-même.
        const availableExcludingThisSale =
          computedBatch.currentHeadcount + (wasCounted ? existing.quantity : 0);
        if (newQuantity > availableExcludingThisSale) {
          throw new ConflictException(
            `Quantité vendue (${newQuantity}) supérieure à l'effectif disponible (${availableExcludingThisSale}).`,
          );
        }
      }
    } else {
      // OEUFS — les ajustements de stock réels sont effectués après la mise
      // à jour de la vente ci-dessous (reverseFifo/consumeFifo/adjustFifo).
      // Contrairement à la création, pas de transaction Serializable unique
      // ici : une modification vise une vente précise déjà identifiée par
      // son id (un seul utilisateur authentifié à la fois), le risque de
      // concurrence réelle est sans commune mesure avec la création de
      // nouvelles ventes qui se disputent le même stock.
      if (willBeCounted) {
        const available = await this.eggStockService.getAvailableQuantity(
          actingUser.farmId,
          existing.layerBatchId!,
        );
        const availableExcludingThisSale = available + (wasCounted ? existing.quantity : 0);
        if (newQuantity > availableExcludingThisSale) {
          throw new ConflictException(
            `Quantité vendue (${newQuantity}) supérieure au stock d'œufs disponible (${availableExcludingThisSale}).`,
          );
        }
      }
    }

    const newUnitPrice = dto.unitPriceFcfa ?? existing.unitPriceFcfa;
    const newDiscount = dto.discountFcfa ?? existing.discountFcfa;
    const grossAmountFcfa = computeGrossAmountFcfa(newQuantity, newUnitPrice);
    const netAmountFcfa = computeNetAmountFcfa(grossAmountFcfa, newDiscount);

    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        ...dto,
        grossAmountFcfa,
        netAmountFcfa,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });

    if (existing.productType === 'OEUFS') {
      if (wasCounted && !willBeCounted) {
        await this.eggStockService.reverseFifo(actingUser, id);
      } else if (!wasCounted && willBeCounted) {
        await this.eggStockService.consumeFifo(actingUser, existing.layerBatchId!, newQuantity, id);
      } else if (wasCounted && willBeCounted && newQuantity !== existing.quantity) {
        await this.eggStockService.adjustFifo(actingUser, existing.layerBatchId!, id, newQuantity);
      }
    }

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'sale',
      entityId: id,
      action: 'SALE_UPDATED',
      oldValues: {
        quantity: existing.quantity,
        status: existing.status,
        netAmountFcfa: existing.netAmountFcfa,
      },
      newValues: { ...dto, netAmountFcfa },
      ipAddress,
    });

    return updated;
  }

  /** §17 : "interdire la suppression silencieuse d'une vente payée" — étendu
   * à l'annulation (un statut ANNULEE efface la vente des calculs
   * d'effectif/stock et de chiffre d'affaires tout aussi silencieusement
   * qu'une suppression). */
  async cancel(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<Sale> {
    const existing = await this.findOne(actingUser, id);
    if (PAID_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        "Impossible d'annuler une vente déjà payée ou partiellement payée.",
      );
    }

    if (existing.productType === 'OEUFS' && countsTowardAvailability(existing.status)) {
      await this.eggStockService.reverseFifo(actingUser, id);
    }

    const updated = await this.prisma.sale.update({ where: { id }, data: { status: 'ANNULEE' } });

    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'sale',
      entityId: id,
      action: 'SALE_CANCELLED',
      oldValues: { status: existing.status },
      newValues: { status: 'ANNULEE' },
      ipAddress,
    });

    return updated;
  }
}
