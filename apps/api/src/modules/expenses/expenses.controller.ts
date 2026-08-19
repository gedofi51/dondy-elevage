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
import type { Expense } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses.query.dto';

@Controller('expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.EXPENSES_CREATE)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateExpenseDto,
    @Req() req: Request,
  ): Promise<Expense> {
    return this.expensesService.create(user, dto, req.ip ?? null);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.EXPENSES_READ)
  async findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListExpensesQueryDto,
  ): Promise<Expense[]> {
    return this.expensesService.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EXPENSES_READ)
  async findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<Expense> {
    return this.expensesService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EXPENSES_UPDATE)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @Req() req: Request,
  ): Promise<Expense> {
    return this.expensesService.update(user, id, dto, req.ip ?? null);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EXPENSES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.expensesService.remove(user, id, req.ip ?? null);
  }
}
