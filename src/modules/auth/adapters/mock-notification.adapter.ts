import { Injectable, Logger } from '@nestjs/common';
import { INotificationAdapter } from '../interfaces/notification-adapter.interface';

@Injectable()
export class MockNotificationAdapter implements INotificationAdapter {
  private readonly logger = new Logger(MockNotificationAdapter.name);

  async sendVerificationCode(destination: string, code: string): Promise<void> {
    this.logger.log(
      `[MOCK] Code de verification pour ${destination} : ${code}`,
    );
  }
}
