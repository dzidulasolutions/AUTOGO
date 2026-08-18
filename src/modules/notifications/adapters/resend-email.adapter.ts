import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { IEmailAdapter } from '../interfaces/email-adapter.interface';

@Injectable()
export class ResendEmailAdapter implements IEmailAdapter {
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private resend: Resend;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
  }

  async send(to: string, subject: string, htmlContent: string): Promise<void> {
    try {
      const result = await this.resend.emails.send({
        from: 'AuTogo <onboarding@resend.dev>', // domaine de test Resend, a remplacer par un vrai domaine verifie en prod
        to,
        subject,
        html: htmlContent,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      this.logger.log(`Email envoye a ${to} : ${subject}`);
    } catch (error) {
      // Ne fait jamais planter l'action metier principale a cause d'un echec d'envoi
      this.logger.error(`Echec envoi email a ${to}`, error);
    }
  }
}
