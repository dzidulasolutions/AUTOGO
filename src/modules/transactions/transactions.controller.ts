import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Patch,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';
import { TransactionFiltersDto } from './dto/transaction-filters.dto';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../../types/express';
@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les transactions avec filtres' })
  findAll(
    @Query() filters: TransactionFiltersDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.transactionsService.findAll(user, filters);
  }

  @Post()
  @RequirePermissions('transactions:create')
  @AuditResource('Transaction')
  @ApiOperation({ summary: 'Creer une transaction' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.transactionsService.createTransaction(dto, user);
  }

  @Patch(':id/cancel')
  @RequirePermissions('transactions:cancel')
  @AuditResource('Transaction')
  @ApiOperation({
    summary: 'Annuler une transaction (Comptable/Admin uniquement)',
  })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelTransactionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.transactionsService.cancelTransaction(id, dto, user);
  }
}
