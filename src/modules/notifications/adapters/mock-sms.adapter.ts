import { Injectable, Logger } from '@nestjs/common';
import { ISmsAdapter } from '../interfaces/sms-adapter.interface';

@Injectable()
export class MockSmsAdapter implements ISmsAdapter {
  private readonly logger = new Logger(MockSmsAdapter.name);

  async send(phoneNumber: string, message: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.logger.log(`[MOCK SMS] Vers ${phoneNumber} : ${message}`);
  }
}
