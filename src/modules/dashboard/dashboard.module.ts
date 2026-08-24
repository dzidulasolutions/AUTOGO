import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CacheService } from './cache.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, CacheService]
})
export class DashboardModule {}
