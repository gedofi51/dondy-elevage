import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Payroll } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import type { AccessTokenPayload } from '../../auth/jwt-payload.interface';
import { EmployeesService } from '../employees.service';
import type { CreatePayrollDto } from './dto/create-payroll.dto';
import type { UpdatePayrollDto } from './dto/update-payroll.dto';
import { assertPayrollEditable, assertPeriodValid } from './payroll.validation';
import {
  assertNetPayNotNegative,
  computeNetPayFcfa,
  sumOutstandingAdvancesFcfa,
} from './calculations/payroll.calculations';

const MAX_TRANSACTION_RETRIES = 3;

/** Même seuil/discipline que MaintenanceTasksService (Phase 20) —
 * verrou justifié ici (contrairement à Attendance/EmployeeTask) : la
 * création d'un relevé balaie et lie les avances non déduites de
 * l'employé (SalaryAdvance.deductedInPayrollId), une vraie ressource
 * partagée que deux créations concurrentes pour le même employé
 * pourraient toutes deux lire comme "non déduite" avant qu'aucune ne
 * commette — double comptage possible sans verrou.
 *
 * P2034 = conflit/deadlock détecté par Prisma au niveau ORM. P2010 =
 * "Raw query failed", remonté quand le deadlock survient DANS un
 * `$queryRaw` (le `FOR UPDATE` ci-dessous) — le vrai code MySQL (1213/
 * 1205) est niché dans `meta.driverAdapterError.cause.originalCode`,
 * voir DETTE_TECHNIQUE.md Phase 20/Lot 2 pour l'historique complet de ce
 * correctif. */
function isSerializationFailure(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code === 'P2034') {
    return true;
  }
  if (error.code === 'P2010') {
    const meta = error.meta as
      { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined;
    const originalCode = meta?.driverAdapterError?.cause?.originalCode;
    return originalCode === '1213' || originalCode === '1205';
  }
  return false;
}

interface LockedEmployeeRow {
  id: string;
  farmId: string;
  baseSalaryFcfa: number;
}

/**
 * Suivi indicatif de la paie (voir MODULE_PERSONNEL.md, précision de
 * périmètre) — pas de calcul légal de charges/fiscalité, pas de
 * bulletin à valeur légale. Aucun lien automatique vers Expense/Payment
 * ce lot (décision confirmée avant implémentation, voir
 * DETTE_TECHNIQUE.md) : un précédent mécanique existe
 * (MaintenanceInterventionsService → Expense) mais QUAND déclencher la
 * création sans doublonner une saisie manuelle du Comptable est un
 * choix produit différé, pas seulement un câblage technique.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly employeesService: EmployeesService,
  ) {}

  private async getRaw(employeeId: string, id: string): Promise<Payroll> {
    const payroll = await this.prisma.payroll.findUnique({ where: { id } });
    if (!payroll || payroll.employeeId !== employeeId) {
      throw new NotFoundException('Relevé de paie introuvable.');
    }
    return payroll;
  }

  /** Verrouille l'employé (empêche deux créations concurrentes de
   * balayer les mêmes avances), relit baseSalaryFcfa au moment du
   * commit (pas celui du pré-contrôle, voir create()), balaie les
   * avances non déduites, calcule et persiste netFcfa, lie les avances
   * balayées — tout dans la même transaction. */
  private async runCreateTransaction(
    actingUser: AccessTokenPayload,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
    dto: CreatePayrollDto,
  ): Promise<Payroll> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockedEmployeeRow[]>`
        SELECT id, farmId, baseSalaryFcfa FROM employees
        WHERE id = ${employeeId}
        FOR UPDATE
      `;
      const employee = rows[0];
      if (!employee) {
        throw new NotFoundException('Employé introuvable.');
      }

      const outstanding = await tx.salaryAdvance.findMany({
        where: { employeeId, deductedInPayrollId: null },
        select: { id: true, amountFcfa: true },
      });
      const advancesDeductedFcfa = sumOutstandingAdvancesFcfa(outstanding);
      const bonusFcfa = dto.bonusFcfa ?? 0;
      const deductionsFcfa = dto.deductionsFcfa ?? 0;
      const netFcfa = computeNetPayFcfa(
        employee.baseSalaryFcfa,
        bonusFcfa,
        deductionsFcfa,
        advancesDeductedFcfa,
      );
      assertNetPayNotNegative(netFcfa);

      let created: Payroll;
      try {
        created = await tx.payroll.create({
          data: {
            farmId: employee.farmId,
            employeeId,
            periodStart,
            periodEnd,
            baseSalaryFcfa: employee.baseSalaryFcfa,
            bonusFcfa,
            deductionsFcfa,
            netFcfa,
            observations: dto.observations,
            createdBy: actingUser.sub,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(
            'Un relevé de paie existe déjà pour cet employé sur cette période.',
          );
        }
        throw error;
      }

      if (outstanding.length > 0) {
        await tx.salaryAdvance.updateMany({
          where: { id: { in: outstanding.map((advance) => advance.id) } },
          data: { deductedInPayrollId: created.id },
        });
      }

      return created;
    });
  }

  async create(
    actingUser: AccessTokenPayload,
    employeeId: string,
    dto: CreatePayrollDto,
    ipAddress: string | null,
  ): Promise<Payroll> {
    const employee = await this.employeesService.findOne(actingUser, employeeId);
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    assertPeriodValid(periodStart, periodEnd);

    let payroll: Payroll | undefined;
    for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        payroll = await this.runCreateTransaction(
          actingUser,
          employeeId,
          periodStart,
          periodEnd,
          dto,
        );
        break;
      } catch (error) {
        if (error instanceof ConflictException || error instanceof NotFoundException) {
          throw error;
        }
        if (isSerializationFailure(error) && attempt < MAX_TRANSACTION_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }
    // payroll est garanti défini ici : la boucle se termine soit par
    // `break` après une affectation réussie, soit par un `throw`.
    const finalPayroll = payroll!;

    await this.auditLogService.record({
      farmId: employee.farmId,
      userId: actingUser.sub,
      entityType: 'payroll',
      entityId: finalPayroll.id,
      action: 'PAYROLL_CREATED',
      newValues: {
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        netFcfa: finalPayroll.netFcfa,
      },
      ipAddress,
    });

    return finalPayroll;
  }

  async findAll(actingUser: AccessTokenPayload, employeeId: string): Promise<Payroll[]> {
    await this.employeesService.findOne(actingUser, employeeId);
    return this.prisma.payroll.findMany({
      where: { employeeId },
      orderBy: { periodStart: 'asc' },
    });
  }

  async findOne(actingUser: AccessTokenPayload, employeeId: string, id: string): Promise<Payroll> {
    await this.employeesService.findOne(actingUser, employeeId);
    return this.getRaw(employeeId, id);
  }

  async update(
    actingUser: AccessTokenPayload,
    employeeId: string,
    id: string,
    dto: UpdatePayrollDto,
    ipAddress: string | null,
  ): Promise<Payroll> {
    const employee = await this.employeesService.findOne(actingUser, employeeId);
    const existing = await this.getRaw(employeeId, id);
    assertPayrollEditable(existing.status);

    // advancesDeductedFcfa n'est stocké nulle part directement — re-dérivé
    // algébriquement des valeurs déjà persistées (le jeu d'avances liées
    // est fixé à la création, jamais ré-balayé ici, voir
    // payroll.calculations.ts). Recalculé si bonus/retenues changent,
    // pour ne jamais laisser netFcfa périmé avant validation.
    const mergedBonusFcfa = dto.bonusFcfa ?? existing.bonusFcfa;
    const mergedDeductionsFcfa = dto.deductionsFcfa ?? existing.deductionsFcfa;
    const advancesDeductedFcfa =
      existing.baseSalaryFcfa + existing.bonusFcfa - existing.deductionsFcfa - existing.netFcfa;
    const netFcfa = computeNetPayFcfa(
      existing.baseSalaryFcfa,
      mergedBonusFcfa,
      mergedDeductionsFcfa,
      advancesDeductedFcfa,
    );
    assertNetPayNotNegative(netFcfa);

    const updated = await this.prisma.payroll.update({
      where: { id },
      data: {
        bonusFcfa: dto.bonusFcfa,
        deductionsFcfa: dto.deductionsFcfa,
        netFcfa,
        status: dto.status,
        observations: dto.observations,
      },
    });

    await this.auditLogService.record({
      farmId: employee.farmId,
      userId: actingUser.sub,
      entityType: 'payroll',
      entityId: id,
      action: dto.status === 'VALIDE' ? 'PAYROLL_VALIDATED' : 'PAYROLL_UPDATED',
      oldValues: {
        status: existing.status,
        bonusFcfa: existing.bonusFcfa,
        deductionsFcfa: existing.deductionsFcfa,
      },
      newValues: { ...dto },
      ipAddress,
    });

    return updated;
  }
}
