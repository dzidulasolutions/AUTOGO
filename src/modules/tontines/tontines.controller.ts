import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TontinesService } from './tontines.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';
import { Patch, Param } from '@nestjs/common';
import { MissedCollectionSchedulerService } from './missed-collection-scheduler.service';
import { Get } from '@nestjs/common';
import type { Response } from 'express';

@ApiTags('tontines')
@ApiBearerAuth()
@Controller('tontines')
export class TontinesController {
  constructor(
    private tontinesService: TontinesService,
    private missedScheduler: MissedCollectionSchedulerService,
  ) {}

  @Post('cycles')
  @RequirePermissions('tontines:create')
  @AuditResource('TontineCycle')
  @ApiOperation({ summary: 'Creer un cycle de tontine' })
  createCycle(@Body() dto: CreateCycleDto, @Req() req) {
    return this.tontinesService.createCycle(dto, req.user);
  }

  @Get('cycles/:id/collections')
  @ApiOperation({ summary: "Voir le calendrier complet d'un cycle (carnet)" })
  getCycleCollections(@Param('id') id: string, @Req() req) {
    return this.tontinesService.getCycleCollections(id, req.user);
  }

  @Get('cycles/:id/passbook-pdf')
  @ApiOperation({ summary: 'Telecharger le carnet en PDF' })
  async downloadPassbook(
    @Param('id') id: string,
    @Req() req,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.tontinesService.generatePassbookPdf(
      id,
      req.user,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="carnet-tontine.pdf"',
    });
    res.send(pdfBuffer);
  }

  @Patch('collections/:id/validate')
  @RequirePermissions('tontines:create') // reutilise la meme permission pour l'instant
  @AuditResource('TontineCollection')
  @ApiOperation({ summary: 'Valider une collecte (jour normal ou rattrapage)' })
  validateCollection(
    @Param('id') id: string,
    @Body() dto: { idempotencyKey: string },
    @Req() req,
  ) {
    return this.tontinesService.validateCollection(id, dto, req.user);
  }

  @Post('trigger-missed-check-test')
  @RequirePermissions('tontines:create')
  async triggerMissedCheckTest() {
    await this.missedScheduler.scheduleMissedCheck();
    return { message: 'Verification des echeances manquees declenchee' };
  }

  @Patch('cycles/:id/close')
  @RequirePermissions('tontines:create')
  @AuditResource('TontineCycle')
  @ApiOperation({
    summary: 'Cloturer un cycle et restituer le montant collecte',
  })
  closeCycle(
    @Param('id') id: string,
    @Body() dto: { idempotencyKey: string },
    @Req() req,
  ) {
    return this.tontinesService.closeCycle(id, dto, req.user);
  }
}
