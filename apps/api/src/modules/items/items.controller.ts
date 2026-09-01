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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { ItemsService, type ItemWithComputed } from './items.service';
import type { ItemForecast } from './calculations/stock-forecast.calculations';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ListItemsQueryDto } from './dto/list-items.query.dto';

@Controller('items')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ITEMS_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateItemDto,
    @Req() req: Request,
  ): Promise<ItemWithComputed> {
    return this.itemsService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ITEMS_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListItemsQueryDto,
  ): Promise<ItemWithComputed[]> {
    return this.itemsService.findAll(user, query);
  }

  /** Doit rester déclarée avant @Get(':id') — sinon Nest matcherait
   * "previsions" comme :id (routes évaluées dans l'ordre de déclaration,
   * même précaution que GET /employees/roster, Lot 7-correctif). */
  @Get('previsions')
  @RequirePermissions(PERMISSIONS.ITEMS_READ)
  async previsions(@CurrentUser() user: AccessTokenPayload): Promise<ItemForecast[]> {
    return this.itemsService.findAllForecast(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ITEMS_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<ItemWithComputed> {
    return this.itemsService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ITEMS_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
    @Req() req: Request,
  ): Promise<ItemWithComputed> {
    return this.itemsService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ITEMS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.itemsService.remove(user, id, req.ip ?? null);
  }
}
