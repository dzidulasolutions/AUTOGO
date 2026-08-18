import { Injectable, Logger } from '@nestjs/common';
import { INotificationAdapter } from '../interfaces/notification-adapter.interface';

@Injectable()
export class MockNotificationAdapter implements INotificationAdapter {
  private readonly logger = new Logger(MockNotificationAdapter.name);

  async sendVerificationCode(destination: string, code: string): Promise<void> {
    // Simule un delai reseau realiste, comme un vrai fournisseur SMS le ferait
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.logger.log(
      `[MOCK SMS] Vers ${destination} : Votre code AuTogo est ${code}`,
    );
  }
}
