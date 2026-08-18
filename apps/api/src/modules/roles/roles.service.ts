import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catalogue de rôles système, disponible pour toute ferme (voir schema.prisma). */
  async findAll() {
    return this.prisma.role.findMany({
      where: { farmId: null },
      select: { id: true, name: true, isSystem: true },
      orderBy: { name: 'asc' },
    });
  }
}
