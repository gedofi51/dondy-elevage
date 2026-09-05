import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Block } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';

/** Permissions BUILDINGS_* réutilisées telles quelles, pas de permission
 * BLOCKS_* dédiée — un Bloc est une sous-unité d'un Bâtiment, gérée par
 * les mêmes rôles (décision explicite de l'investigation Bâtiments/Blocs,
 * voir DETTE_TECHNIQUE.md). Le catalogue RBAC actuel ne suggère aucune
 * granularité différente : les rôles ayant BUILDINGS_READ n'ont jamais
 * BUILDINGS_UPDATE sans BUILDINGS_READ, etc. — même hiérarchie attendue
 * pour les blocs. */
@Controller('blocks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.BUILDINGS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateBlockDto,
    @Req() req: Request,
  ): Promise<Block> {
    return this.blocksService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.BUILDINGS_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<Block[]> {
    return this.blocksService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BUILDINGS_READ)
  async findOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<Block> {
    return this.blocksService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BUILDINGS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBlockDto,
    @Req() req: Request,
  ): Promise<Block> {
    return this.blocksService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.BUILDINGS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.blocksService.remove(user, id, req.ip ?? null);
  }
}
