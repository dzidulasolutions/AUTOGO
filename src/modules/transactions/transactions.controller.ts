import { Controller, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Post()
  @RequirePermissions('transactions:create')
  @AuditResource('Transaction')
  @ApiOperation({ summary: 'Creer une transaction' })
  create(@Body() dto: CreateTransactionDto, @Req() req) {
    return this.transactionsService.createTransaction(dto, req.user);
  }
}
