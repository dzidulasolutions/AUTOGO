import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MockSmsAdapter } from './adapters/mock-sms.adapter';
import { ResendEmailAdapter } from './adapters/resend-email.adapter';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'pdf' },
      { name: 'reports' },
    ),
  ],
  providers: [MockSmsAdapter, ResendEmailAdapter],
  exports: [BullModule, MockSmsAdapter, ResendEmailAdapter],
})
export class NotificationsModule {}
