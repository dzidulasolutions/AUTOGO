import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MockSmsAdapter } from './adapters/mock-sms.adapter';
import { ResendEmailAdapter } from './adapters/resend-email.adapter';
import { ReceiptProcessor } from './processors/receipt.processor';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    UploadsModule,
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'pdf' },
      { name: 'reports' },
    ),
  ],
  providers: [MockSmsAdapter, ResendEmailAdapter, ReceiptProcessor],
  exports: [BullModule, MockSmsAdapter, ResendEmailAdapter],
})
export class NotificationsModule {}
