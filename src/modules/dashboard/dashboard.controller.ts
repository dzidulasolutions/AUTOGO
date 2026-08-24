import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('branch-summary')
  @ApiOperation({ summary: 'Resume quotidien de l\'agence (30 derniers jours)' })
  getBranchSummary(@Query('branchId') branchId: string, @Req() req) {
    return this.dashboardService.getBranchSummary(req.user, branchId);
  }

  @Get('portfolio-at-risk')
  @ApiOperation({ summary: 'Portefeuille de prets a risque' })
  getPortfolioAtRisk(@Req() req) {
    return this.dashboardService.getPortfolioAtRisk(req.user);
  }

  @Get('my-daily-collections')
  @ApiOperation({ summary: 'Mes collectes du jour (Agent)' })
  getMyDailyCollections(@Req() req) {
    return this.dashboardService.getMyDailyCollections(req.user);
  }
}