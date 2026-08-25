import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { TontinesController } from './tontines.controller';
import { TontinesService } from './tontines.service';
import { BullModule } from '@nestjs/bullmq';
import { MissedCollectionProcessor } from './missed-collection.processor';
import { MissedCollectionSchedulerService } from './missed-collection-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsService } from '../settings/settings.service';
import { CacheService } from '../dashboard/cache.service';
@Module({
  imports: [
    NotificationsModule,
    TransactionsModule,
    BullModule.registerQueue({ name: 'tontine-missed-check' }),
  ],
  controllers: [TontinesController],
  providers: [
    TontinesService,
    MissedCollectionSchedulerService,
    MissedCollectionProcessor,
    SettingsService,
    CacheService,
  ],
})
export class TontinesModule {}
