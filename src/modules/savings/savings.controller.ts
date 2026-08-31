import { InterestSchedulerService } from './interest-scheduler.service';
import { Controller, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SavingsService } from './savings.service';
import { OpenAccountDto } from './dto/open-account.dto';
import { SavingsOperationDto } from './dto/savings-operation.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../../types/express';

@ApiTags('savings')
@ApiBearerAuth()
@Controller('savings')
export class SavingsController {
  constructor(
    private savingsService: SavingsService,
    private interestSchedulerService: InterestSchedulerService,
  ) {}

  @Post('accounts')
  @RequirePermissions('savings:create')
  @AuditResource('SavingsAccount')
  @ApiOperation({ summary: 'Ouvrir un compte epargne' })
  openAccount(
    @Body() dto: OpenAccountDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.savingsService.openAccount(dto, user);
  }

  @Post('accounts/:id/deposit')
  @RequirePermissions('savings:deposit')
  @AuditResource('SavingsAccount')
  @ApiOperation({ summary: 'Deposer sur un compte epargne' })
  deposit(
    @Param('id') id: string,
    @Body() dto: SavingsOperationDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.savingsService.deposit(id, dto, user);
  }

  @Post('accounts/:id/withdraw')
  @RequirePermissions('savings:withdraw')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @AuditResource('SavingsAccount')
  @ApiOperation({ summary: "Retirer d'un compte epargne" })
  withdraw(
    @Param('id') id: string,
    @Body() dto: SavingsOperationDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.savingsService.withdraw(id, dto, user);
  }

  @Post('trigger-interest-test')
  @RequirePermissions('savings:deposit') // reutilise une permission existante pour ce test
  async triggerInterestTest() {
    await this.interestSchedulerService.scheduleMonthlyInterest();
    return { message: "Job d'interet declenche manuellement pour test" };
  }
}
