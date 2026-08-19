import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type EggStockLot,
  type EggStockMovement,
  type EggStockMovementType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import {
  computeFifoAllocation,
  type EggStockLotForFifo,
} from './calculations/egg-stock-fifo.calculations';
import { computeLotRemaining } from './calculations/egg-stock-lot.calculations';
import type { CreateEggStockMovementDto } from './dto/create-egg-stock-movement.dto';
import type { ListEggStockLotsQueryDto } from './dto/list-egg-stock-lots.query.dto';
import type { ListEggStockMovementsQueryDto } from './dto/list-egg-stock-movements.query.dto';

const MAX_TRANSACTION_RETRIES = 3;

/** Types qu'un utilisateur peut saisir manuellement — SORTIE_VENTE et
 * ENTREE_ANNULATION sont exclusivement gérés par consumeFifo/reverseFifo
 * (jamais via la saisie manuelle §5.4). */
const MANUAL_MOVEMENT_TYPES: EggStockMovementType[] = [
  'PERTE_CASSE',
  'PERTE_SOUILLURE',
  'CONSOMMATION_INTERNE',
  'DON',
  'PERTE_AUTRE',
];

export interface EggStockLotWithRemaining extends EggStockLot {
  remaining: number;
}

/** P2034 : code Prisma officiel pour "Transaction failed due to a write
 * conflict or a deadlock. Please retry your transaction" — couvre à la
 * fois les deadlocks et les échecs de sérialisation, quel que soit le
 * provider (MySQL/MariaDB inclus). */
function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

@Injectable()
export class EggStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async attachRemaining(lot: EggStockLot): Promise<EggStockLotWithRemaining> {
    const movements = await this.prisma.eggStockMovement.findMany({ where: { lotId: lot.id } });
    return { ...lot, remaining: computeLotRemaining(lot.quantityProduced, movements) };
  }

  async findLots(
    actingUser: AccessTokenPayload,
    query: ListEggStockLotsQueryDto,
  ): Promise<EggStockLotWithRemaining[]> {
    const lots = await this.prisma.eggStockLot.findMany({
      where: { farmId: actingUser.farmId, batchId: query.batchId },
      orderBy: { productionDate: 'asc' },
    });
    return Promise.all(lots.map((lot) => this.attachRemaining(lot)));
  }

  async findLot(actingUser: AccessTokenPayload, id: string): Promise<EggStockLotWithRemaining> {
    const lot = await this.prisma.eggStockLot.findUnique({ where: { id } });
    if (!lot) {
      throw new NotFoundException('Lot de stock introuvable.');
    }
    assertSameFarm(actingUser, lot.farmId);
    return this.attachRemaining(lot);
  }

  async findMovements(
    actingUser: AccessTokenPayload,
    query: ListEggStockMovementsQueryDto,
  ): Promise<EggStockMovement[]> {
    return this.prisma.eggStockMovement.findMany({
      where: { farmId: actingUser.farmId, lotId: query.lotId },
      orderBy: { date: 'desc' },
    });
  }

  /** §5.4 : quantité totale disponible pour un lot de pondeuses, tous
   * calibres/lots d'œufs confondus — utilisé par SalesService pour la
   * vérification de disponibilité avant vente (§15). */
  async getAvailableQuantity(farmId: string, layerBatchId: string): Promise<number> {
    const lots = await this.prisma.eggStockLot.findMany({
      where: { farmId, batchId: layerBatchId },
      include: { movements: true },
    });
    return lots.reduce(
      (sum, lot) => sum + computeLotRemaining(lot.quantityProduced, lot.movements),
      0,
    );
  }

  /**
   * Cœur de l'allocation FIFO, exécuté à l'intérieur d'une transaction déjà
   * ouverte par l'appelant — factorisé pour être réutilisable tel quel
   * depuis consumeFifo (transaction dédiée) ET depuis SalesService.create
   * (même transaction que la création de la vente : EggStockMovement.saleId
   * exige que la vente existe déjà, donc vente+consommation doivent réussir
   * ou échouer ensemble — voir SalesService.createEggSaleAndConsumeStock).
   *
   * Verrouillage `SELECT ... FOR UPDATE` sur les lignes de lot (au lieu
   * d'une transaction `isolationLevel: Serializable`, voir l'historique de
   * ce choix ci-dessous sur consumeFifo) : une deuxième transaction
   * concurrente ciblant le même lot de pondeuses est mise en attente ici
   * par InnoDB jusqu'au commit/rollback de la première, puis relit la
   * valeur validée la plus récente (FOR UPDATE ignore l'instantané
   * repeatable-read de la transaction pour les lignes verrouillées) —
   * pattern MySQL standard pour "réserver depuis un pool à quantité
   * limitée", largement éprouvé, sous l'isolation par défaut (pas besoin
   * de Serializable). Premier SQL brut de ce projet : nécessaire, Prisma
   * n'expose aucune clause de verrouillage via son query builder ; requête
   * paramétrée via le tagged template `$queryRaw` (échappement automatique,
   * aucune concaténation de chaîne).
   */
  private async consumeFifoInternal(
    tx: Prisma.TransactionClient,
    farmId: string,
    layerBatchId: string,
    quantity: number,
    saleId: string,
    recordedBy: string,
  ): Promise<void> {
    const lockedLots = await tx.$queryRaw<
      { id: string; productionDate: Date; quantityProduced: number }[]
    >`
      SELECT id, productionDate, quantityProduced FROM egg_stock_lots
      WHERE farmId = ${farmId} AND batchId = ${layerBatchId}
      ORDER BY productionDate ASC
      FOR UPDATE
    `;

    const movements = await tx.eggStockMovement.findMany({
      where: { lotId: { in: lockedLots.map((lot) => lot.id) } },
    });
    const movementsByLot = new Map<string, typeof movements>();
    for (const movement of movements) {
      const list = movementsByLot.get(movement.lotId) ?? [];
      list.push(movement);
      movementsByLot.set(movement.lotId, list);
    }

    const lotsForFifo: EggStockLotForFifo[] = lockedLots.map((lot) => ({
      id: lot.id,
      productionDate: lot.productionDate,
      remaining: computeLotRemaining(lot.quantityProduced, movementsByLot.get(lot.id) ?? []),
    }));
    const allocation = computeFifoAllocation(lotsForFifo, quantity);
    if (!allocation) {
      throw new ConflictException(
        `Stock d'œufs insuffisant pour ce lot (quantité demandée : ${quantity}).`,
      );
    }
    for (const item of allocation) {
      await tx.eggStockMovement.create({
        data: {
          farmId,
          lotId: item.lotId,
          type: 'SORTIE_VENTE',
          quantity: item.quantity,
          date: new Date(),
          saleId,
          recordedBy,
        },
      });
    }
  }

  /** À utiliser depuis une transaction déjà ouverte par l'appelant (voir
   * SalesService.createEggSaleAndConsumeStock) — ne gère pas elle-même le
   * retry, c'est la responsabilité de l'appelant qui possède la
   * transaction. */
  async consumeFifoInTransaction(
    tx: Prisma.TransactionClient,
    farmId: string,
    layerBatchId: string,
    quantity: number,
    saleId: string,
    recordedBy: string,
  ): Promise<void> {
    return this.consumeFifoInternal(tx, farmId, layerBatchId, quantity, saleId, recordedBy);
  }

  /**
   * Consomme le stock d'œufs d'un lot de pondeuses en FIFO — ouvre sa
   * propre transaction.
   *
   * Historique de conception (important pour un futur mainteneur) :
   * l'implémentation initiale utilisait `isolationLevel: Serializable` +
   * retry sur échec de sérialisation (P2034). Un test e2e de concurrence
   * (deux ventes simultanées) a reproduit un BLOCAGE INDÉFINI (plusieurs
   * heures) sur cette combinaison précise. Diagnostic (voir résumé de
   * mission Phase 4 pour le détail complet) :
   *   - `SHOW FULL PROCESSLIST`/`information_schema.innodb_trx` pendant le
   *     blocage ne montraient AUCUNE transaction active côté MySQL, ni
   *     aucun verrou en attente — la base de données elle-même n'était
   *     jamais bloquée.
   *   - Un garde-fou applicatif (withTimeout, Promise.race avec un
   *     setTimeout) n'a PAS résolu le blocage — vérifié séparément que
   *     withTimeout fonctionne correctement sur une promesse JS bloquée
   *     ordinaire, ce qui exclut un bug dans le garde-fou lui-même.
   *   - Conclusion : le blocage empêche l'exécution de tout timer JS
   *     (starvation de la boucle d'événements ou blocage bas niveau dans
   *     le driver), donc AUCUN mécanisme basé sur une Promise ne peut s'en
   *     prémunir côté application.
   *   - Cause proximale confirmée en amont : bug connu et non résolu de
   *     @prisma/adapter-mariadb 7.9.1 (seule version stable publiée à ce
   *     jour) où des connexions ne sont pas rendues au pool et restent
   *     "Sleep" indéfiniment (prisma/prisma#28964) ; le nombre de
   *     connexions orphelines observées (10) correspond exactement à
   *     `connectionLimit` par défaut du driver `mariadb`.
   * Décision retenue : remplacer `isolationLevel: Serializable` par un
   * verrouillage `SELECT ... FOR UPDATE` classique (voir
   * consumeFifoInternal) — un mécanisme MySQL standard, indépendant du
   * chemin de code manifestement fragile de l'adaptateur pour
   * l'isolation Serializable. Revérifié : 5 exécutions consécutives du
   * test de concurrence e2e réussies (~3 s chacune, aucun blocage).
   *
   * Le retry sur P2034 est conservé par prudence pour un deadlock InnoDB
   * classique (toujours possible avec FOR UPDATE, bien que peu probable
   * ici — verrouillage dans un ordre déterministe), mais la correction
   * contre la survente concurrente ne dépend plus du tout de ce retry :
   * FOR UPDATE la garantit dès la première tentative.
   */
  async consumeFifo(
    actingUser: AccessTokenPayload,
    layerBatchId: string,
    quantity: number,
    saleId: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        await this.prisma.$transaction((tx) =>
          this.consumeFifoInternal(
            tx,
            actingUser.farmId,
            layerBatchId,
            quantity,
            saleId,
            actingUser.sub,
          ),
        );
        return;
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
  }

  /** Annulation d'une vente d'œufs : jamais de suppression/édition des
   * SORTIE_VENTE d'origine — mouvements ENTREE_ANNULATION compensatoires,
   * symétrique au pattern déjà établi par Payment (append-only). */
  async reverseFifo(actingUser: AccessTokenPayload, saleId: string): Promise<void> {
    const movements = await this.prisma.eggStockMovement.findMany({
      where: { saleId, type: 'SORTIE_VENTE' },
    });
    if (movements.length === 0) {
      return;
    }
    await this.prisma.$transaction(
      movements.map((m) =>
        this.prisma.eggStockMovement.create({
          data: {
            farmId: m.farmId,
            lotId: m.lotId,
            type: 'ENTREE_ANNULATION',
            quantity: m.quantity,
            date: new Date(),
            saleId,
            reason: 'Annulation de la vente',
            recordedBy: actingUser.sub,
          },
        }),
      ),
    );
  }

  /** Modification de quantité sur une vente d'œufs déjà confirmée :
   * reverse-then-redo dans le même esprit — on compense l'existant puis on
   * relance le FIFO avec la nouvelle quantité. */
  async adjustFifo(
    actingUser: AccessTokenPayload,
    layerBatchId: string,
    saleId: string,
    newQuantity: number,
  ): Promise<void> {
    await this.reverseFifo(actingUser, saleId);
    await this.consumeFifo(actingUser, layerBatchId, newQuantity, saleId);
  }

  /** Saisie manuelle des pertes/casse/souillure/don/consommation interne
   * (§5.4) — indépendante d'une vente. */
  async createManualMovement(
    actingUser: AccessTokenPayload,
    dto: CreateEggStockMovementDto,
    ipAddress: string | null,
  ): Promise<EggStockMovement> {
    if (!MANUAL_MOVEMENT_TYPES.includes(dto.type)) {
      throw new BadRequestException(
        'Ce type de mouvement est géré automatiquement par les ventes, pas par la saisie manuelle.',
      );
    }

    const lot = await this.prisma.eggStockLot.findUnique({
      where: { id: dto.lotId },
      include: { movements: true },
    });
    if (!lot || lot.farmId !== actingUser.farmId) {
      throw new NotFoundException('Lot de stock introuvable.');
    }
    const remaining = computeLotRemaining(lot.quantityProduced, lot.movements);
    if (dto.quantity > remaining) {
      throw new ConflictException(
        `Quantité (${dto.quantity}) supérieure au stock restant du lot (${remaining}).`,
      );
    }

    const movement = await this.prisma.eggStockMovement.create({
      data: {
        farmId: actingUser.farmId,
        lotId: dto.lotId,
        type: dto.type,
        quantity: dto.quantity,
        date: new Date(dto.date),
        reason: dto.reason,
        recordedBy: actingUser.sub,
      },
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'egg_stock_movement',
      entityId: movement.id,
      action: 'EGG_STOCK_MOVEMENT_CREATED',
      newValues: { lotId: dto.lotId, type: dto.type, quantity: dto.quantity },
      ipAddress,
    });

    return movement;
  }
}
