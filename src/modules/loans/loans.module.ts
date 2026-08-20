import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { BullModule } from '@nestjs/bullmq';
import { OverdueSchedulerService } from './overdue-scheduler.service';
import { OverdueProcessor } from './overdue.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    TransactionsModule,
    BullModule.registerQueue({ name: 'loan-overdue-check' }),
  ],
  controllers: [LoansController],
  providers: [LoansService, OverdueSchedulerService, OverdueProcessor],
})
export class LoansModule {}
