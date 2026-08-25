import { Module } from '@nestjs/common';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { BullModule } from '@nestjs/bullmq';
import { InterestSchedulerService } from './interest-scheduler.service';
import { InterestProcessor } from './interest.processor';
import { SettingsService } from '../settings/settings.service';
import { CacheService } from '../dashboard/cache.service';

@Module({
  imports: [
    TransactionsModule,
    BullModule.registerQueue({
      name: 'interest-calculation', // le nom de la file, comme le nom d'un guichet precis
    }),
  ],
  controllers: [SavingsController],
  providers: [
    SavingsService,
    InterestSchedulerService,
    InterestProcessor,
    SettingsService,
    CacheService,
  ],
})
export class SavingsModule {}
