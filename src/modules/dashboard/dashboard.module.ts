import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CacheService } from './cache.service';
import { UploadsModule } from '../uploads/uploads.module';
import { ReportProcessor } from './processors/report.processor';

@Module({
  imports: [UploadsModule, BullModule.registerQueue({ name: 'reports' })],
  controllers: [DashboardController],
  providers: [DashboardService, CacheService, ReportProcessor],
})
export class DashboardModule {}
