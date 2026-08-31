import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../../types/express';
import { Prisma } from '../../../generated/prisma/client';

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
  update(
    @Param('key') key: string,
    @Body() dto: { value: Prisma.InputJsonValue },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.settingsService.set(key, dto.value, user.id);
  }
}
