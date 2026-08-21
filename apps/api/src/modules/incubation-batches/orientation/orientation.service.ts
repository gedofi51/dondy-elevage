import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type BatchLineage } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { assertSameFarm } from '../../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { BroilerBatchesService } from '../../broiler-batches/broiler-batches.service';
import { ChickBatchesService } from '../../chick-batches/chick-batches.service';
import type { CreateOrientationDto } from './dto/create-orientation.dto';

interface ChildAuditPayload {
  entityType: string;
  entityId: string;
  action: string;
  newValues: Prisma.InputJsonValue;
}

/** Phase 8 : couvre à la fois les échecs de sérialisation liés au verrou
 * FOR UPDATE (P2034) et les collisions de code (P2002, BroilerBatchesService.
 * create() appelé avec tx n'a aucun retry P2002 interne). */
const MAX_TRANSACTION_RETRIES = 3;

function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function isUniqueConstraintFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Cœur métier de l'orientation des poussins (§6.5) — action distincte d'un
 * simple PATCH, car une même incubation peut produire plusieurs lignes
 * d'orientation vers des destinations différentes (§16-D). Branche par
 * transformationType :
 *  - CHAIR : réutilise BroilerBatchesService.create() tel quel
 *    (origin=NAISSANCE_INTERNE, valeur d'enum existante depuis la Phase 3,
 *    jamais utilisée jusqu'ici) — aucun ChickBatch intermédiaire.
 *  - VENTE / RENOUVELLEMENT : crée un ChickBatch (ChickBatchesService.
 *    createInternal, jamais exposé en CREATE public).
 *  - REFORME_PERTE : aucune entité enfant, seulement la ligne BatchLineage
 *    avec un motif.
 * Vérification de disponibilité (chicksHatched - déjà orienté) : lecture
 * agrégée puis comparaison, SANS verrou — dette technique transversale
 * assumée, voir docs/architecture/DETTE_TECHNIQUE.md (même schéma que
 * SalesService/POULET_CHAIR depuis la Phase 3, pas un nouveau gap ; ce
 * point ne concerne QUE l'absence de verrou sur la lecture-comparaison,
 * pas l'atomicité de l'écriture, traitée ci-dessous).
 *
 * Atomicité de l'écriture : la création de l'entité enfant (le cas
 * échéant) et la ligne BatchLineage sont dans une même transaction Prisma
 * (`this.prisma.$transaction`), comme la bande de chair + ses 45 journées
 * en Phase 3 (BroilerBatchesService.create()). BroilerBatchesService.create()
 * et ChickBatchesService.createInternal() acceptent un `tx` optionnel :
 * quand il est fourni, ils écrivent avec ce client au lieu d'ouvrir leur
 * propre transaction, et ne journalisent PAS eux-mêmes (le log serait
 * visible avant le commit et resterait orphelin si l'écriture suivante,
 * dans cette même transaction, échouait). Tous les logs d'audit sont donc
 * émis ici, après le commit — un échec de l'INSERT BatchLineage annule
 * désormais aussi la création de l'entité enfant (plus d'entité orpheline
 * possible), et aucun log ne peut référencer une écriture annulée.
 */
@Injectable()
export class OrientationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly broilerBatchesService: BroilerBatchesService,
    private readonly chickBatchesService: ChickBatchesService,
  ) {}

  async orient(
    actingUser: AccessTokenPayload,
    incubationBatchId: string,
    dto: CreateOrientationDto,
    ipAddress: string | null,
  ): Promise<BatchLineage> {
    const incubation = await this.prisma.incubationBatch.findUnique({
      where: { id: incubationBatchId },
    });
    if (!incubation) {
      throw new NotFoundException("Lot d'incubation introuvable.");
    }
    assertSameFarm(actingUser, incubation.farmId);
    if (incubation.chicksHatched === null) {
      throw new BadRequestException(
        "Impossible d'orienter des poussins avant la saisie du bilan d'éclosion (chicksHatched).",
      );
    }

    // Pré-vérification rapide hors transaction (message d'erreur immédiat
    // au cas non-concurrent) — la garantie réelle contre le dépassement
    // concurrent reste le verrouillage FOR UPDATE ci-dessous (Phase 8).
    const alreadyOrientedAgg = await this.prisma.batchLineage.aggregate({
      where: { incubationBatchId },
      _sum: { quantity: true },
    });
    const available = incubation.chicksHatched - (alreadyOrientedAgg._sum.quantity ?? 0);
    if (dto.quantity > available) {
      throw new ConflictException(
        `Quantité orientée (${dto.quantity}) supérieure aux poussins disponibles (${available}).`,
      );
    }

    const chicksHatched = incubation.chicksHatched;
    const { lineage, childType, childId, childAuditPayload } = await this.orientLocked(
      actingUser,
      incubationBatchId,
      chicksHatched,
      incubation.actualHatchDate,
      dto,
      ipAddress,
    );

    if (childAuditPayload) {
      await this.auditLogService.record({
        ...childAuditPayload,
        farmId: actingUser.farmId,
        userId: actingUser.sub,
        ipAddress,
      });
    }

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'batch_lineage',
      entityId: lineage.id,
      action: 'CHICKS_ORIENTED',
      newValues: {
        incubationBatchId,
        transformationType: dto.transformationType,
        quantity: dto.quantity,
        childType,
        childId,
      },
      ipAddress,
    });

    return lineage;
  }

  /**
   * Phase 8 — durcissement concurrence (dette transversale "disponibilité
   * sans verrou" corrigée). Verrouille la ligne IncubationBatch
   * (SELECT ... FOR UPDATE) EN PREMIER dans la transaction déjà existante
   * depuis la Phase 5 (atomicité entité-enfant + BatchLineage), recalcule
   * l'agrégat "déjà orienté" via ce même client, compare, puis poursuit la
   * logique de branche inchangée. Boucle retry ajoutée (absente jusqu'ici) :
   * une transaction par tentative, comme les autres correctifs de cette
   * phase.
   */
  private async orientLocked(
    actingUser: AccessTokenPayload,
    incubationBatchId: string,
    chicksHatched: number,
    actualHatchDate: Date | null,
    dto: CreateOrientationDto,
    ipAddress: string | null,
  ): Promise<{
    lineage: BatchLineage;
    childType: string | null;
    childId: string | null;
    childAuditPayload: ChildAuditPayload | null;
  }> {
    for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const [locked] = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM incubation_batches
            WHERE id = ${incubationBatchId} AND farmId = ${actingUser.farmId}
            FOR UPDATE
          `;
          if (!locked) {
            throw new NotFoundException("Lot d'incubation introuvable.");
          }
          const lockedOrientedAgg = await tx.batchLineage.aggregate({
            where: { incubationBatchId },
            _sum: { quantity: true },
          });
          const lockedAvailable = chicksHatched - (lockedOrientedAgg._sum.quantity ?? 0);
          if (dto.quantity > lockedAvailable) {
            throw new ConflictException(
              `Quantité orientée (${dto.quantity}) supérieure aux poussins disponibles (${lockedAvailable}).`,
            );
          }

          let childType: string | null = null;
          let childId: string | null = null;
          let childAuditPayload: ChildAuditPayload | null = null;

          if (dto.transformationType === 'CHAIR') {
            if (!dto.buildingId || !dto.primaryManagerId) {
              throw new BadRequestException(
                'buildingId et primaryManagerId requis pour orienter vers une bande de chair.',
              );
            }
            const arrivalDate = actualHatchDate ?? new Date();
            const broilerBatch = await this.broilerBatchesService.create(
              actingUser,
              {
                arrivalDate: arrivalDate.toISOString(),
                origin: 'NAISSANCE_INTERNE',
                orderedQuantity: dto.quantity,
                receivedQuantity: dto.quantity,
                unitPriceFcfa: 0,
                buildingId: dto.buildingId,
                primaryManagerId: dto.primaryManagerId,
              },
              ipAddress,
              tx,
            );
            childType = 'broiler_batch';
            childId = broilerBatch.id;
            childAuditPayload = {
              entityType: 'broiler_batch',
              entityId: broilerBatch.id,
              action: 'BROILER_BATCH_CREATED',
              newValues: {
                code: broilerBatch.code,
                receivedQuantity: broilerBatch.receivedQuantity,
                buildingId: broilerBatch.buildingId,
              },
            };
          } else if (
            dto.transformationType === 'VENTE' ||
            dto.transformationType === 'RENOUVELLEMENT'
          ) {
            if (dto.transformationType === 'RENOUVELLEMENT' && !dto.buildingId) {
              throw new BadRequestException(
                "buildingId requis pour orienter vers un lot de renouvellement (housing nécessaire pour l'élevage).",
              );
            }
            const chickBatch = await this.chickBatchesService.createInternal(
              actingUser,
              {
                purpose: dto.transformationType,
                initialQuantity: dto.quantity,
                buildingId: dto.buildingId,
              },
              ipAddress,
              tx,
            );
            childType = 'chick_batch';
            childId = chickBatch.id;
            childAuditPayload = {
              entityType: 'chick_batch',
              entityId: chickBatch.id,
              action: 'CHICK_BATCH_CREATED',
              newValues: {
                code: chickBatch.code,
                purpose: dto.transformationType,
                initialQuantity: dto.quantity,
              },
            };
          } else {
            if (!dto.reason) {
              throw new BadRequestException('reason requis pour une réforme/perte.');
            }
          }

          const lineage = await tx.batchLineage.create({
            data: {
              farmId: actingUser.farmId,
              incubationBatchId,
              transformationType: dto.transformationType,
              quantity: dto.quantity,
              childType,
              childId,
              reason: dto.transformationType === 'REFORME_PERTE' ? dto.reason : undefined,
              date: new Date(),
              createdBy: actingUser.sub,
            },
          });

          return { lineage, childType, childId, childAuditPayload };
        });
      } catch (error) {
        if (error instanceof ConflictException || error instanceof BadRequestException) {
          throw error;
        }
        if (
          (isSerializationFailure(error) || isUniqueConstraintFailure(error)) &&
          attempt < MAX_TRANSACTION_RETRIES - 1
        ) {
          continue;
        }
        throw error;
      }
    }
    // Inatteignable (la boucle retourne ou lève systématiquement), requis pour TypeScript.
    throw new ConflictException("Impossible de finaliser l'orientation — réessayer.");
  }
}
