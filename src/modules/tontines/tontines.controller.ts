import { Controller, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TontinesService } from './tontines.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';

@ApiTags('tontines')
@ApiBearerAuth()
@Controller('tontines')
export class TontinesController {
  constructor(private tontinesService: TontinesService) {}

  @Post('cycles')
  @RequirePermissions('tontines:create')
  @AuditResource('TontineCycle')
  @ApiOperation({ summary: 'Creer un cycle de tontine' })
  createCycle(@Body() dto: CreateCycleDto, @Req() req) {
    return this.tontinesService.createCycle(dto, req.user);
  }
}
