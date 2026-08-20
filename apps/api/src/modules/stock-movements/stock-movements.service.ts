import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type StockMovement,
  type StockMovementReason,
  type StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { computeWeightedAverageCost } from '../items/calculations/cump.calculations';
import type { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import type { ListStockMovementsQueryDto } from './dto/list-stock-movements.query.dto';

const MAX_TRANSACTION_RETRIES = 3;
/** Reasons dont l'entrée ne réinjecte jamais de coût saisi dans le CUMP —
 * neutre (un surplus d'inventaire ou un retour n'a pas de prix d'achat
 * réel), voir plan Phase 7 section D. */
const CUMP_NEUTRAL_ENTRY_REASONS: StockMovementReason[] = ['RETOUR', 'AJUSTEMENT'];
/** Réservés aux flux automatiques dédiés — jamais via la saisie manuelle
 * (même discipline que EggStockService.MANUAL_MOVEMENT_TYPES). */
const AUTOMATIC_ONLY_REASONS: StockMovementReason[] = ['ACHAT', 'DISTRIBUTION_BANDE'];

export interface RecordMovementParams {
  farmId: string;
  itemId: string;
  type: StockMovementType;
  reason: StockMovementReason;
  quantity: number;
  date: Date;
  createdBy: string;
  justification?: string;
  /** Coût saisi — requis pour ACHAT/PRODUCTION_INTERNE, ignoré sinon (CUMP
   * courant utilisé à la place). */
  unitCostFcfa?: number;
  sourceType?: string;
  sourceId?: string;
}

function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

@Injectable()
export class StockMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Point d'entrée UNIQUE d'écriture sur Item.currentStock/
   * averageUnitCostFcfa — aucun autre service n'écrit ces deux champs
   * directement (discipline nécessaire, voir schema.prisma sur Item).
   * `tx` OBLIGATOIRE (jamais optionnel, contrairement à
   * BroilerBatchesService.create(..., tx?)) — verrouillage
   * `SELECT ... FOR UPDATE` sur la ligne Item dans la transaction déjà
   * ouverte par l'appelant, pattern EggStockService.consumeFifoInternal.
   * N'audit-log PAS elle-même (voir OrientationService, Phase 5) : le
   * log serait visible avant le commit de la transaction englobante —
   * c'est à l'appelant de journaliser après son propre commit.
   */
  async recordMovementInTransaction(
    tx: Prisma.TransactionClient,
    params: RecordMovementParams,
  ): Promise<StockMovement> {
    if (params.quantity <= 0) {
      throw new BadRequestException('La quantité du mouvement doit être positive.');
    }
    if (params.reason === 'AJUSTEMENT' && !params.justification?.trim()) {
      throw new BadRequestException(
        '§15 : justification requise pour un mouvement de type AJUSTEMENT.',
      );
    }

    const [locked] = await tx.$queryRaw<
      { id: string; currentStock: string; averageUnitCostFcfa: number }[]
    >`
      SELECT id, currentStock, averageUnitCostFcfa FROM items
      WHERE id = ${params.itemId} AND farmId = ${params.farmId}
      FOR UPDATE
    `;
    if (!locked) {
      throw new NotFoundException('Article introuvable.');
    }
    const currentStock = Number(locked.currentStock);

    let unitCostFcfaSnapshot: number;
    let newAverageUnitCostFcfa = locked.averageUnitCostFcfa;
    let newStock: number;

    if (params.type === 'ENTREE') {
      const isNeutralEntry = CUMP_NEUTRAL_ENTRY_REASONS.includes(params.reason);
      if (!isNeutralEntry && params.unitCostFcfa === undefined) {
        throw new BadRequestException('unitCostFcfa requis pour ACHAT/PRODUCTION_INTERNE.');
      }
      unitCostFcfaSnapshot = isNeutralEntry ? locked.averageUnitCostFcfa : params.unitCostFcfa!;
      newAverageUnitCostFcfa = computeWeightedAverageCost(
        currentStock,
        locked.averageUnitCostFcfa,
        params.quantity,
        unitCostFcfaSnapshot,
      );
      newStock = currentStock + params.quantity;
    } else {
      unitCostFcfaSnapshot = locked.averageUnitCostFcfa;
      newStock = currentStock - params.quantity;
      if (newStock < 0) {
        throw new ConflictException(
          `Stock insuffisant pour cet article (disponible : ${currentStock}, demandé : ${params.quantity}).`,
        );
      }
    }

    await tx.item.update({
      where: { id: params.itemId },
      data: { currentStock: newStock, averageUnitCostFcfa: newAverageUnitCostFcfa },
    });

    return tx.stockMovement.create({
      data: {
        farmId: params.farmId,
        itemId: params.itemId,
        type: params.type,
        reason: params.reason,
        quantity: params.quantity,
        unitCostFcfaSnapshot,
        totalValueFcfa: Math.round(params.quantity * unitCostFcfaSnapshot),
        justification: params.justification,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        date: params.date,
        createdBy: params.createdBy,
      },
    });
  }

  /** Saisie manuelle (ajustement/inventaire/retour/perte/casse/
   * consommation interne/vente directe d'article) — ouvre sa propre
   * transaction, retry sur deadlock InnoDB (P2034, comme EggStockService.
   * consumeFifo — jamais isolationLevel: Serializable, voir
   * DETTE_TECHNIQUE.md). */
  async create(
    actingUser: AccessTokenPayload,
    dto: CreateStockMovementDto,
    ipAddress: string | null,
  ): Promise<StockMovement> {
    if (AUTOMATIC_ONLY_REASONS.includes(dto.reason)) {
      throw new BadRequestException(
        'Ce motif est géré automatiquement (réception de commande / distribution à une bande), pas par la saisie manuelle.',
      );
    }

    for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        const movement = await this.prisma.$transaction((tx) =>
          this.recordMovementInTransaction(tx, {
            farmId: actingUser.farmId,
            itemId: dto.itemId,
            type: dto.type,
            reason: dto.reason,
            quantity: dto.quantity,
            date: new Date(dto.date),
            createdBy: actingUser.sub,
            justification: dto.justification,
            unitCostFcfa: dto.unitCostFcfa,
          }),
        );

        await this.auditLogService.record({
          farmId: actingUser.farmId,
          userId: actingUser.sub,
          entityType: 'stock_movement',
          entityId: movement.id,
          action: 'STOCK_MOVEMENT_CREATED',
          newValues: {
            itemId: dto.itemId,
            type: dto.type,
            reason: dto.reason,
            quantity: dto.quantity,
          },
          ipAddress,
        });

        return movement;
      } catch (error) {
        if (
          error instanceof ConflictException ||
          error instanceof BadRequestException ||
          error instanceof NotFoundException
        ) {
          throw error;
        }
        if (isSerializationFailure(error) && attempt < MAX_TRANSACTION_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Impossible d’enregistrer le mouvement — réessayer.');
  }

  async findAll(
    actingUser: AccessTokenPayload,
    query: ListStockMovementsQueryDto,
  ): Promise<StockMovement[]> {
    return this.prisma.stockMovement.findMany({
      where: { farmId: actingUser.farmId, itemId: query.itemId },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<StockMovement> {
    const movement = await this.prisma.stockMovement.findUnique({ where: { id } });
    if (!movement) {
      throw new NotFoundException('Mouvement de stock introuvable.');
    }
    assertSameFarm(actingUser, movement.farmId);
    return movement;
  }
}
