import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  Req,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { RejectLoanDto } from './dto/reject-loan.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';
import { LoanFiltersDto } from './dto/loan-filters.dto';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private loansService: LoansService) {}

  @Post()
  @RequirePermissions('loans:create')
  @AuditResource('Loan')
  @ApiOperation({ summary: 'Creer une demande de pret (brouillon)' })
  create(@Body() dto: CreateLoanDto, @Req() req) {
    return this.loansService.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les prets (filtrable par client, statut)' })
  findAll(@Query() filters: LoanFiltersDto, @Req() req) {
    return this.loansService.findAll(req.user, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulter un pret en detail (avec echeancier)' })
  findOne(@Param('id') id: string, @Req() req) {
    return this.loansService.findOne(id, req.user);
  }

  @Patch(':id/submit')
  @RequirePermissions('loans:create')
  @AuditResource('Loan')
  @ApiOperation({ summary: 'Soumettre la demande pour approbation' })
  submit(@Param('id') id: string, @Req() req) {
    return this.loansService.submitForApproval(id, req.user);
  }

  @Patch(':id/approve')
  @RequirePermissions('loans:approve')
  @AuditResource('Loan')
  @ApiOperation({ summary: 'Approuver un pret' })
  approve(@Param('id') id: string, @Req() req) {
    return this.loansService.approve(id, req.user);
  }

  @Patch(':id/reject')
  @RequirePermissions('loans:approve')
  @AuditResource('Loan')
  @ApiOperation({ summary: 'Rejeter un pret' })
  reject(@Param('id') id: string, @Body() dto: RejectLoanDto, @Req() req) {
    return this.loansService.reject(id, dto, req.user);
  }
}
