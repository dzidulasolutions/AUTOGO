import {
  Controller,
  Post,
  Body,
  Req,
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

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les transactions avec filtres' })
  findAll(@Query() filters: TransactionFiltersDto, @Req() req) {
    return this.transactionsService.findAll(req.user, filters);
  }

  @Post()
  @RequirePermissions('transactions:create')
  @AuditResource('Transaction')
  @ApiOperation({ summary: 'Creer une transaction' })
  create(@Body() dto: CreateTransactionDto, @Req() req) {
    return this.transactionsService.createTransaction(dto, req.user);
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
    @Req() req,
  ) {
    return this.transactionsService.cancelTransaction(id, dto, req.user);
  }
}
