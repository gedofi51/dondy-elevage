import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Document } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { assertSameFarm } from '../../common/rbac/farm-scope.util';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { DocumentValidationService } from './document-validation.service';
import { DocumentStorageService } from './document-storage.service';
import type { CreateDocumentDto } from './dto/create-document.dto';
import type { ListDocumentsQueryDto } from './dto/list-documents.query.dto';

// storedName volontairement exclu des réponses API : détail d'implémentation
// du stockage disque, jamais exposé au client (voir DocumentStorageService).
const publicDocumentSelect = {
  id: true,
  farmId: true,
  entityType: true,
  entityId: true,
  category: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  createdBy: true,
} satisfies Prisma.DocumentSelect;

export type PublicDocument = Prisma.DocumentGetPayload<{ select: typeof publicDocumentSelect }>;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly validation: DocumentValidationService,
    private readonly storage: DocumentStorageService,
  ) {}

  async upload(
    actingUser: AccessTokenPayload,
    dto: CreateDocumentDto,
    file: Express.Multer.File,
    ipAddress: string | null,
  ): Promise<PublicDocument> {
    const { mimeType, extension } = this.validation.validate(file.buffer);
    const storedName = await this.storage.save(file.buffer, extension);

    const document = await this.prisma.document.create({
      data: {
        farmId: actingUser.farmId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        category: dto.category,
        // Conservé pour affichage uniquement — jamais utilisé pour construire
        // un chemin sur disque (voir storedName, DocumentStorageService).
        originalName: file.originalname.slice(0, 191),
        storedName,
        mimeType,
        sizeBytes: file.size,
        createdBy: actingUser.sub,
      },
      select: publicDocumentSelect,
    });

    await this.auditLogService.record({
      farmId: actingUser.farmId,
      userId: actingUser.sub,
      entityType: 'document',
      entityId: document.id,
      action: 'DOCUMENT_UPLOADED',
      newValues: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        category: dto.category,
        mimeType,
        sizeBytes: file.size,
      },
      ipAddress,
    });

    return document;
  }

  async findAll(
    actingUser: AccessTokenPayload,
    query: ListDocumentsQueryDto,
  ): Promise<PublicDocument[]> {
    return this.prisma.document.findMany({
      where: {
        farmId: actingUser.farmId,
        deletedAt: null,
        entityType: query.entityType,
        entityId: query.entityId,
      },
      select: publicDocumentSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Usage interne uniquement (téléchargement/suppression) — retourne le
   * modèle complet, storedName inclus, mais ce résultat n'est jamais
   * sérialisé tel quel dans une réponse JSON au client.
   */
  private async findOneInternal(actingUser: AccessTokenPayload, id: string): Promise<Document> {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document || document.deletedAt) {
      throw new NotFoundException('Document introuvable.');
    }
    assertSameFarm(actingUser, document.farmId);
    return document;
  }

  /** Pour le controller de téléchargement : chemin + métadonnées nécessaires (Content-Type, nom d'affichage). */
  async getForDownload(
    actingUser: AccessTokenPayload,
    id: string,
  ): Promise<{ path: string; mimeType: string; originalName: string }> {
    const document = await this.findOneInternal(actingUser, id);
    return {
      path: this.storage.resolvePath(document.storedName),
      mimeType: document.mimeType,
      originalName: document.originalName,
    };
  }

  async remove(
    actingUser: AccessTokenPayload,
    id: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.findOneInternal(actingUser, id);
    // Soft delete uniquement : les octets du fichier ne sont reconstructibles
    // depuis aucune autre trace (contrairement à une ligne Supplier/Customer)
    // — le fichier physique n'est jamais supprimé sur ce chemin.
    await this.prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditLogService.record({
      farmId: existing.farmId,
      userId: actingUser.sub,
      entityType: 'document',
      entityId: id,
      action: 'DOCUMENT_DELETED',
      oldValues: { originalName: existing.originalName, entityType: existing.entityType },
      ipAddress,
    });
  }
}
