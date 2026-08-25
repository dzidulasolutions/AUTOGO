import { Controller, Get, Query, Req, Param, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from 'src/common/decorators/require-permissions.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Post('reports/monthly')
  @RequirePermissions('loans:approve')
  requestReport(
    @Body() dto: { branchId: string; month: number; year: number },
    @Req() req,
  ) {
    return this.dashboardService.requestMonthlyReport(
      dto.branchId,
      dto.month,
      dto.year,
      req.user,
    );
  }

  @Post('reports/trigger-monthly-test')
  @RequirePermissions('loans:approve')
  async triggerMonthlyReportsTest() {
    await this.dashboardService.generateMonthlyReportsForAllBranches();
    return {
      message:
        'Generation des rapports mensuels declenchee pour toutes les agences',
    };
  }

  @Get('branch-summary')
  @ApiOperation({ summary: "Resume quotidien de l'agence (30 derniers jours)" })
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

  @Get('reports/:id')
  getReportStatus(@Param('id') id: string) {
    return this.dashboardService.getReportStatus(id);
  }
}
