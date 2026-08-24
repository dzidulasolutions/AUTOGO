import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from './cache.service';

type CurrentUser = { id: string; role: string; branchId: string | null };

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  private isPrivileged(role: string): boolean {
    return ['SuperAdmin', 'Admin'].includes(role);
  }

  async getBranchSummary(currentUser: CurrentUser, targetBranchId?: string) {
    // Un Manager ne peut consulter que sa propre agence ; Admin peut cibler n'importe laquelle
    const branchId = this.isPrivileged(currentUser.role)
      ? targetBranchId
      : currentUser.branchId;

    if (!branchId) {
      throw new Error('Agence non determinee');
    }

    const cacheKey = `dashboard:branch-summary:${branchId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.prisma.$queryRaw`
      SELECT * FROM v_branch_daily_summary WHERE branch_id = ${branchId}::uuid
      ORDER BY summary_date DESC LIMIT 30
    `;

    await this.cache.set(cacheKey, result, 300); // cache 5 minutes
    return result;
  }

  async getPortfolioAtRisk(currentUser: CurrentUser) {
    const cacheKey = this.isPrivileged(currentUser.role)
      ? 'dashboard:portfolio-risk:all'
      : `dashboard:portfolio-risk:${currentUser.branchId}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = this.isPrivileged(currentUser.role)
      ? await this.prisma.$queryRaw`SELECT * FROM v_loan_portfolio_at_risk`
      : await this.prisma.$queryRaw`SELECT * FROM v_loan_portfolio_at_risk WHERE branch_id = ${currentUser.branchId}::uuid`;

    await this.cache.set(cacheKey, result, 300);
    return result;
  }


  async getMyDailyCollections(currentUser: CurrentUser) {
        // Vue specifiquement pensee pour un Agent : pas de cache ici, doit rester a jour en temps reel
    // (un agent valide une collecte et doit voir la liste se rafraichir immediatement)
  return this.prisma.$queryRaw`
    SELECT * FROM v_agent_daily_collections WHERE assigned_agent_id = ${currentUser.id}
  `;
}
}