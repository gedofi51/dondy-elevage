import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toDataURL } from 'qrcode';
import { QrEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import { PERMISSIONS, type PermissionCode } from '../../common/rbac/permissions.constants';
import { generateOpaqueToken, hashOpaqueToken } from '../../common/security/opaque-token.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';

/**
 * Permission de LECTURE exigée pour résoudre un scan, par type d'entité —
 * mêmes contrôles RBAC qu'un accès direct à la fiche (règle métier
 * explicite du Lot 1). À étendre ici (jamais par un switch dupliqué
 * ailleurs) pour tout futur type QR-able.
 */
const QR_ENTITY_READ_PERMISSION: Record<QrEntityType, PermissionCode> = {
  BROILER_BATCH: PERMISSIONS.BROILER_BATCHES_READ,
  LAYER_BATCH: PERMISSIONS.LAYER_BATCHES_READ,
  ASSET: PERMISSIONS.ASSETS_READ,
  ITEM: PERMISSIONS.ITEMS_READ,
};

/**
 * Ré-existence de l'entité cible, revérifiée à CHAQUE résolution (pas
 * seulement à la génération) : entityId n'est pas une FK Prisma (même
 * patron que Document/AuditLog), une entité supprimée depuis doit faire
 * échouer le scan en 404, jamais rediriger vers une fiche fantôme.
 */
const QR_ENTITY_EXISTS: Record<
  QrEntityType,
  (prisma: PrismaService, id: string) => Promise<boolean>
> = {
  BROILER_BATCH: async (prisma, id) => (await prisma.broilerBatch.count({ where: { id } })) > 0,
  LAYER_BATCH: async (prisma, id) => (await prisma.layerBatch.count({ where: { id } })) > 0,
  ASSET: async (prisma, id) => (await prisma.asset.count({ where: { id } })) > 0,
  ITEM: async (prisma, id) => (await prisma.item.count({ where: { id } })) > 0,
};

export interface QrCodeStatusResult {
  id: string;
  entityType: QrEntityType;
  entityId: string;
  revoked: boolean;
  createdAt: Date;
  scanCount: number;
  lastScannedAt: Date | null;
}

export interface QrCodeGeneratedResult extends QrCodeStatusResult {
  qrCodeDataUrl: string;
  /** Même URL que celle encodée dans qrCodeDataUrl, en clair — repli
   * copiable (affichage/partage manuel) et seul moyen d'exercer la
   * résolution depuis un test automatisé (décoder un PNG n'en est pas
   * un). N'ajoute aucune fuite : c'est l'information déjà portée par le
   * QR affiché à l'écran. */
  scanUrl: string;
}

export interface QrCodeScanEntry {
  id: string;
  scannedAt: Date;
  scannedByUserId: string | null;
}

const RECENT_SCANS_LIMIT = 20;

/**
 * Moteur générique du Lot 1 QR Codes — invoqué exclusivement depuis les
 * modules nestés `broiler-batches/qr-code`, `layer-batches/qr-code`,
 * `assets/qr-code`, `items/qr-code` (chacun vérifie d'abord l'existence
 * et l'appartenance-ferme de SA propre entité via son propre
 * `XxxService.findOne()`, même patron que AttendanceService/
 * EmployeesService — voir ces modules). Cette classe ne reçoit donc
 * jamais un entityId non vérifié, à l'exception de `resolveToken()` qui
 * fait elle-même tous les contrôles (c'est tout son rôle).
 */
@Injectable()
export class QrCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  private buildScanUrl(rawToken: string): string {
    return `${this.config.get<string>('APP_URL')}/scanner/${rawToken}`;
  }

  private async buildGeneratedResult(
    id: string,
    entityType: QrEntityType,
    entityId: string,
    createdAt: Date,
    rawToken: string,
  ): Promise<QrCodeGeneratedResult> {
    const scanUrl = this.buildScanUrl(rawToken);
    return {
      id,
      entityType,
      entityId,
      revoked: false,
      createdAt,
      scanCount: 0,
      lastScannedAt: null,
      scanUrl,
      qrCodeDataUrl: await toDataURL(scanUrl),
    };
  }

  private async summarizeScans(
    qrCodeId: string,
  ): Promise<{ scanCount: number; lastScannedAt: Date | null }> {
    const [scanCount, last] = await Promise.all([
      this.prisma.qrCodeScan.count({ where: { qrCodeId } }),
      this.prisma.qrCodeScan.findFirst({
        where: { qrCodeId },
        orderBy: { scannedAt: 'desc' },
        select: { scannedAt: true },
      }),
    ]);
    return { scanCount, lastScannedAt: last?.scannedAt ?? null };
  }

  private async createActive(
    actingUser: AccessTokenPayload,
    entityType: QrEntityType,
    entityId: string,
    farmId: string,
  ): Promise<{ id: string; createdAt: Date; rawToken: string }> {
    const rawToken = generateOpaqueToken();
    const created = await this.prisma.qrCode.create({
      data: {
        farmId,
        entityType,
        entityId,
        tokenHash: hashOpaqueToken(rawToken),
        createdBy: actingUser.sub,
      },
    });
    return { id: created.id, createdAt: created.createdAt, rawToken };
  }

  /** Échoue si un QR actif existe déjà pour cette fiche — voir regenerate()
   * pour le remplacer explicitement. */
  async generate(
    actingUser: AccessTokenPayload,
    entityType: QrEntityType,
    entityId: string,
    farmId: string,
    ipAddress: string | null,
  ): Promise<QrCodeGeneratedResult> {
    const active = await this.prisma.qrCode.findFirst({
      where: { entityType, entityId, revokedAt: null },
    });
    if (active) {
      throw new ConflictException(
        'Un QR actif existe déjà pour cette fiche — utilisez la régénération.',
      );
    }
    const created = await this.createActive(actingUser, entityType, entityId, farmId);
    await this.auditLogService.record({
      farmId,
      userId: actingUser.sub,
      entityType: 'qr_code',
      entityId: created.id,
      action: 'QR_CODE_GENERATED',
      newValues: { targetEntityType: entityType, targetEntityId: entityId },
      ipAddress,
    });
    return this.buildGeneratedResult(
      created.id,
      entityType,
      entityId,
      created.createdAt,
      created.rawToken,
    );
  }

  /** Révoque l'éventuel QR actif puis en crée un nouveau, atomiquement —
   * jamais deux QR actifs simultanés pour la même fiche (invariant
   * appliqué ici, pas en contrainte BDD, voir schema.prisma). */
  async regenerate(
    actingUser: AccessTokenPayload,
    entityType: QrEntityType,
    entityId: string,
    farmId: string,
    ipAddress: string | null,
  ): Promise<QrCodeGeneratedResult> {
    const rawToken = generateOpaqueToken();
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.qrCode.updateMany({
        where: { entityType, entityId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return tx.qrCode.create({
        data: {
          farmId,
          entityType,
          entityId,
          tokenHash: hashOpaqueToken(rawToken),
          createdBy: actingUser.sub,
        },
      });
    });
    await this.auditLogService.record({
      farmId,
      userId: actingUser.sub,
      entityType: 'qr_code',
      entityId: created.id,
      action: 'QR_CODE_REGENERATED',
      newValues: { targetEntityType: entityType, targetEntityId: entityId },
      ipAddress,
    });
    return this.buildGeneratedResult(created.id, entityType, entityId, created.createdAt, rawToken);
  }

  async revoke(
    actingUser: AccessTokenPayload,
    entityType: QrEntityType,
    entityId: string,
    ipAddress: string | null,
  ): Promise<void> {
    const active = await this.prisma.qrCode.findFirst({
      where: { entityType, entityId, revokedAt: null },
    });
    if (!active) {
      throw new NotFoundException('Aucun QR actif pour cette fiche.');
    }
    await this.prisma.qrCode.update({ where: { id: active.id }, data: { revokedAt: new Date() } });
    await this.auditLogService.record({
      farmId: active.farmId,
      userId: actingUser.sub,
      entityType: 'qr_code',
      entityId: active.id,
      action: 'QR_CODE_REVOKED',
      oldValues: { targetEntityType: entityType, targetEntityId: entityId },
      ipAddress,
    });
  }

  /** Dernier QR émis pour cette fiche, actif ou révoqué — `null` seulement
   * si aucun QR n'a jamais été généré. Le front distingue lui-même les
   * deux cas ("Générer" vs "Régénérer/Révoquer") via `revoked`. */
  async getStatus(entityType: QrEntityType, entityId: string): Promise<QrCodeStatusResult | null> {
    const current = await this.prisma.qrCode.findFirst({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
    if (!current) {
      return null;
    }
    const { scanCount, lastScannedAt } = await this.summarizeScans(current.id);
    return {
      id: current.id,
      entityType,
      entityId,
      revoked: current.revokedAt !== null,
      createdAt: current.createdAt,
      scanCount,
      lastScannedAt,
    };
  }

  /** Historique des scans les plus récents du QR courant — plafonné
   * (RECENT_SCANS_LIMIT) : écran de gestion, pas un export, connectivité
   * Samba limitée (voir CLAUDE.md). */
  async listRecentScans(entityType: QrEntityType, entityId: string): Promise<QrCodeScanEntry[]> {
    const current = await this.prisma.qrCode.findFirst({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
    if (!current) {
      return [];
    }
    const scans = await this.prisma.qrCodeScan.findMany({
      where: { qrCodeId: current.id },
      orderBy: { scannedAt: 'desc' },
      take: RECENT_SCANS_LIMIT,
      select: { id: true, scannedAt: true, scannedByUserId: true },
    });
    return scans;
  }

  /**
   * Résolution d'un scan — MÊMES contrôles RBAC/farmId qu'un accès direct
   * à la fiche (règle métier explicite du Lot 1). 404 générique dans tous
   * les cas d'échec (jeton inconnu, révoqué, autre ferme, entité
   * supprimée) : ne jamais laisser deviner lequel de ces cas s'est
   * produit — même discipline que assertSameFarm pour l'isolation farmId.
   */
  async resolveToken(
    actingUser: AccessTokenPayload,
    rawToken: string,
    ipAddress: string | null,
  ): Promise<{ entityType: QrEntityType; entityId: string }> {
    const tokenHash = hashOpaqueToken(rawToken);
    const qrCode = await this.prisma.qrCode.findUnique({ where: { tokenHash } });
    if (!qrCode || qrCode.revokedAt) {
      throw new NotFoundException('QR introuvable ou révoqué.');
    }

    assertSameFarm(actingUser, qrCode.farmId);

    const requiredPermission = QR_ENTITY_READ_PERMISSION[qrCode.entityType];
    if (!actingUser.permissions.includes(requiredPermission)) {
      throw new ForbiddenException('Permissions insuffisantes pour cette action.');
    }

    const exists = await QR_ENTITY_EXISTS[qrCode.entityType](this.prisma, qrCode.entityId);
    if (!exists) {
      throw new NotFoundException('QR introuvable ou révoqué.');
    }

    await this.prisma.qrCodeScan.create({
      data: {
        farmId: qrCode.farmId,
        qrCodeId: qrCode.id,
        scannedByUserId: actingUser.sub,
        ipAddress,
      },
    });

    return { entityType: qrCode.entityType, entityId: qrCode.entityId };
  }
}
