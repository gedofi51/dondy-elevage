import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { createReadStream } from 'node:fs';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { DocumentsService, type PublicDocument } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents.query.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_CREATE)
  @UseInterceptors(FileInterceptor('file'))
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async upload(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ): Promise<PublicDocument> {
    if (!file) {
      throw new NotFoundException('Fichier manquant (champ "file").');
    }
    return this.documentsService.upload(user, dto, file, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListDocumentsQueryDto,
  ): Promise<PublicDocument[]> {
    return this.documentsService.findAll(user, query);
  }

  @Get(':id/telecharger')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  async download(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { path, mimeType, originalName } = await this.documentsService.getForDownload(user, id);
    const safeName = originalName.replace(/[\r\n"]/g, '');
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
    });
    return new StreamableFile(createReadStream(path));
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.documentsService.remove(user, id, req.ip ?? null);
  }
}
