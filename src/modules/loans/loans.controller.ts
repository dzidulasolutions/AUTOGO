import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  Req,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { RejectLoanDto } from './dto/reject-loan.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';
import { LoanFiltersDto } from './dto/loan-filters.dto';
import { OverdueSchedulerService } from './overdue-scheduler.service';
import { RescheduleLoanDto } from './dto/reschedule-loan.dto';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(
    private loansService: LoansService,
    private overdueScheduler: OverdueSchedulerService,
  ) {}

  @Post()
  @RequirePermissions('loans:create')
  @AuditResource('Loan')
  @ApiOperation({ summary: 'Creer une demande de pret (brouillon)' })
  create(@Body() dto: CreateLoanDto, @Req() req) {
    return this.loansService.create(dto, req.user);
  }

  @Post('trigger-overdue-check-test')
  @RequirePermissions('loans:approve')
  async triggerOverdueCheckTest() {
    await this.overdueScheduler.scheduleOverdueCheck();
    return { message: 'Verification des echeances en retard declenchee' };
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

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Voir le carnet de remboursement complet (carnet)' })
  getLoanSchedule(@Param('id') id: string, @Req() req) {
    return this.loansService.getLoanSchedule(id, req.user);
  }

  @Get(':id/passbook-pdf')
  @ApiOperation({ summary: "Telecharger l'echeancier en PDF" })
  async downloadPassbook(
    @Param('id') id: string,
    @Req() req,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.loansService.generatePassbookPdf(id, req.user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="echeancier-pret.pdf"',
    });
    res.send(pdfBuffer);
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

  @Patch(':id/disburse')
  @RequirePermissions('loans:approve')
  @AuditResource('Loan')
  @ApiOperation({ summary: 'Decaisser un pret approuve' })
  disburse(
    @Param('id') id: string,
    @Body() dto: { idempotencyKey: string },
    @Req() req,
  ) {
    return this.loansService.disburse(id, dto, req.user);
  }

  @Patch(':id/repay')
  @RequirePermissions('loans:create') // meme permission que la creation, Agent/Caissier collectent les remboursements
  @AuditResource('Loan')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Enregistrer un remboursement (imputation FIFO)' })
  repay(
    @Param('id') id: string,
    @Body() dto: { amount: number; idempotencyKey: string },
    @Req() req,
  ) {
    return this.loansService.recordRepayment(id, dto, req.user);
  }

  @Patch(':id/reschedule')
  @RequirePermissions('loans:approve')
  @AuditResource('Loan')
  @ApiOperation({ summary: "Reechelonner les echeances restantes d'un pret" })
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleLoanDto,
    @Req() req,
  ) {
    return this.loansService.reschedule(id, dto, req.user);
  }
}
