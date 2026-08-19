import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Customer } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

const CODE_PREFIX = 'CLI-';
const CODE_DIGITS = 6;
const MAX_CODE_RETRIES = 3;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Dérivé du dernier code émis (jamais d'un COUNT(*) — pas stable après une
   * suppression : un COUNT décroissant recalculerait un code déjà attribué à
   * une ligne encore existante). Retry sur conflit @@unique([farmId, code])
   * plutôt qu'une transaction — sous MySQL REPEATABLE READ, un $transaction
   * autour de la lecture+écriture n'apporte ici aucune garantie
   * supplémentaire contre deux requêtes concurrentes lisant le même dernier
   * code.
   */
  private async generateCode(farmId: string): Promise<string> {
    const last = await this.prisma.customer.findFirst({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? parseInt(/(\d+)$/.exec(last.code)?.[1] ?? '0', 10) : 0;
    return `${CODE_PREFIX}${String(lastNumber + 1).padStart(CODE_DIGITS, '0')}`;
  }

  async create(
    actingUser: AccessTokenPayload,
    dto: CreateCustomerDto,
    ipAddress: string | null,
  ): Promise<Customer> {
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = await this.generateCode(actingUser.farmId);
      try {
        const customer = await this.prisma.customer.create({
          data: { ...dto, code, farmId: actingUser.farmId, createdBy: actingUser.sub },
        });
        await this.auditLogService.record({
          farmId: actingUser.farmId,
          userId: actingUser.sub,
          entityType: 'customer',
          entityId: customer.id,
          action: 'CUSTOMER_CREATED',
          newValues: { ...dto, code },
          ipAddress,
        });
        return customer;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Impossible de générer un code client unique — réessayer.');
  }

  async findAll(actingUser: AccessTokenPayload): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: { farmId: actingUser.farmId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Client introuvable.');
    }
    assertSameFarm(actingUser, customer.farmId);
    return customer;
  }

  async update(
    actingUser: AccessTokenPayload,
    id: string,
    dto: UpdateCustomerDto,
    ipAddress: string | null,
  ): Promise<Customer> {
    const existing = await this.findOne(actingUser, id);
    const updated = await this.prisma.customer.update({ where: { id }, data: dto });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'customer',
      entityId: id,
      action: 'CUSTOMER_UPDATED',
      oldValues: {
        name: existing.name,
        phone: existing.phone,
        locality: existing.locality,
        address: existing.address,
        type: existing.type,
      },
      newValues: { ...dto },
      ipAddress,
    });
    return updated;
  }

  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOne(actingUser, id);
    await this.prisma.customer.delete({ where: { id } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'customer',
      entityId: id,
      action: 'CUSTOMER_DELETED',
      oldValues: { name: existing.name, code: existing.code },
      ipAddress,
    });
  }
}
