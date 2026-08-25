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
import type { DepreciationEntry } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { AssetsService, type AssetWithComputed } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { ReformAssetDto } from './dto/reform-asset.dto';

@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateAssetDto,
    @Req() req: Request,
  ): Promise<AssetWithComputed> {
    return this.assetsService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<AssetWithComputed[]> {
    return this.assetsService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<AssetWithComputed> {
    return this.assetsService.findOne(user, id);
  }

  @Get(':id/depreciation-entries')
  @RequirePermissions(PERMISSIONS.DEPRECIATION_READ)
  async listDepreciationEntries(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<DepreciationEntry[]> {
    return this.assetsService.listDepreciationEntries(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @Req() req: Request,
  ): Promise<AssetWithComputed> {
    return this.assetsService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.assetsService.remove(user, id, req.ip ?? null);
  }

  @Post(':id/reformer')
  @RequirePermissions(PERMISSIONS.ASSETS_REFORM)
  async reform(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: ReformAssetDto,
    @Req() req: Request,
  ): Promise<AssetWithComputed> {
    return this.assetsService.reform(user, id, dto, req.ip ?? null);
  }
}
