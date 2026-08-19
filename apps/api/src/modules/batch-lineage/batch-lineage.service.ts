import { Injectable } from '@nestjs/common';
import type { BatchLineage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { ListBatchLineageQueryDto } from './dto/list-batch-lineage.query.dto';

/** Module lecture seule — "retrouver l'origine d'un lot orienté" (§6.5).
 * Aucune écriture ici : les lignes sont créées exclusivement par
 * OrientationService, dans la même transaction que l'entité enfant. */
@Injectable()
export class BatchLineageService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    actingUser: AccessTokenPayload,
    query: ListBatchLineageQueryDto,
  ): Promise<BatchLineage[]> {
    return this.prisma.batchLineage.findMany({
      where: {
        farmId: actingUser.farmId,
        incubationBatchId: query.incubationBatchId,
        childType: query.childType,
        childId: query.childId,
      },
      orderBy: { date: 'desc' },
    });
  }
}
