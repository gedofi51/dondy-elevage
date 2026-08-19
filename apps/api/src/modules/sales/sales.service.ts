import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Sale, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { BroilerBatchesService } from '../broiler-batches/broiler-batches.service';
import {
  computeGrossAmountFcfa,
  computeNetAmountFcfa,
} from '../broiler-batches/calculations/broiler-sales.calculations';
import type { CreateSaleDto } from './dto/create-sale.dto';
import type { UpdateSaleDto } from './dto/update-sale.dto';
import type { ListSalesQueryDto } from './dto/list-sales.query.dto';

const NON_COUNTED_STATUSES: SaleStatus[] = ['BROUILLON', 'RESERVEE', 'ANNULEE'];
const PAID_STATUSES: SaleStatus[] = ['PAYEE', 'PARTIELLEMENT_PAYEE'];

function countsTowardHeadcount(status: SaleStatus): boolean {
  return !NON_COUNTED_STATUSES.includes(status);
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly broilerBatchesService: BroilerBatchesService,
  ) {}

  /** Dérivé du dernier numéro émis pour la ferme+année (VTE-AAAA-NNN), même
   * principe que BroilerBatchesService.generateBatchCode. */
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
    // §17 : "interdire une quantité vendue supérieure au disponible" —
    // vérifié dès la création (même en brouillon), pas seulement à la
    // confirmation, pour ne jamais laisser promettre plus que l'effectif réel.
    const computedBatch = await this.broilerBatchesService.findOne(actingUser, dto.batchId);

    await this.assertReferencesBelongToFarm(actingUser.farmId, {
      customerId: dto.customerId,
      sellerId: dto.sellerId,
      actingUserId: actingUser.sub,
    });

    if (dto.quantity > computedBatch.currentHeadcount) {
      throw new ConflictException(
        `Quantité vendue (${dto.quantity}) supérieure à l'effectif disponible (${computedBatch.currentHeadcount}).`,
      );
    }

    const grossAmountFcfa = computeGrossAmountFcfa(dto.quantity, dto.unitPriceFcfa);
    const netAmountFcfa = computeNetAmountFcfa(grossAmountFcfa, dto.discountFcfa ?? 0);
    const saleNumber = await this.generateSaleNumber(
      actingUser.farmId,
      new Date(dto.date).getFullYear(),
    );
    const sellerId = dto.sellerId ?? actingUser.sub;

    const sale = await this.prisma.sale.create({
      data: {
        farmId: actingUser.farmId,
        batchId: dto.batchId,
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
        status: dto.status ?? 'BROUILLON',
        observation: dto.observation,
        createdBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'sale',
      entityId: sale.id,
      action: 'SALE_CREATED',
      newValues: { saleNumber, quantity: dto.quantity, netAmountFcfa, batchId: dto.batchId },
      ipAddress,
    });

    return sale;
  }

  async findAll(actingUser: AccessTokenPayload, query: ListSalesQueryDto): Promise<Sale[]> {
    return this.prisma.sale.findMany({
      where: { farmId: actingUser.farmId, batchId: query.batchId, status: query.status },
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

    if (countsTowardHeadcount(newStatus)) {
      const computedBatch = await this.broilerBatchesService.findOne(actingUser, existing.batchId);
      // currentHeadcount exclut déjà cette vente si elle comptait avant
      // modification — on la réintègre le temps de la comparaison, sinon on
      // se compare à un effectif qui s'exclut lui-même.
      const availableExcludingThisSale =
        computedBatch.currentHeadcount +
        (countsTowardHeadcount(existing.status) ? existing.quantity : 0);
      if (newQuantity > availableExcludingThisSale) {
        throw new ConflictException(
          `Quantité vendue (${newQuantity}) supérieure à l'effectif disponible (${availableExcludingThisSale}).`,
        );
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
   * à l'annulation (un statut ANNULEE efface la vente des calculs d'effectif
   * et de chiffre d'affaires tout aussi silencieusement qu'une suppression). */
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
