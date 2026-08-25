import { Controller, Get, Patch, Body, Param, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @RequirePermissions('settings:manage')
  findAll() {
    return this.settingsService.findAll();
  }

  @Patch(':key')
  @RequirePermissions('settings:manage')
  @AuditResource('Setting')
  @ApiOperation({ summary: 'Modifier un parametre systeme' })
  update(@Param('key') key: string, @Body() dto: { value: any }, @Req() req) {
    return this.settingsService.set(key, dto.value, req.user.id);
  }
}