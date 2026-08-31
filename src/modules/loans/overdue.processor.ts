import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { ResendEmailAdapter } from '../notifications/adapters/resend-email.adapter';

@Processor('loan-overdue-check')
export class OverdueProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private emailAdapter: ResendEmailAdapter,
  ) {
    super();
  }

  async process(job: Job<{ scheduleId: string }>) {
    const { scheduleId } = job.data;

    try {
      const schedule = await this.prisma.loanSchedule.findUnique({
        where: { id: scheduleId },
        include: { loan: { include: { client: true } } },
      });

      if (!schedule || schedule.status !== 'PENDING') return; // deja traite ou paye entre-temps

      await this.prisma.loanSchedule.updateMany({
        where: { id: scheduleId, status: 'PENDING' },
        data: { status: 'OVERDUE' },
      });

      if (schedule.loan.client.email) {
        await this.emailAdapter.send(
          schedule.loan.client.email,
          'Echeance en retard',
          `<p>Bonjour ${schedule.loan.client.firstName},</p><p>Votre echeance de ${Number(schedule.amountDue)} FCFA du pret ${schedule.loan.loanNumber} est en retard. Merci de regulariser rapidement.</p>`,
        );
      }
    } catch (error) {
      console.error(
        `Erreur traitement retard pour echeance ${scheduleId}:`,
        error,
      );
    }
  }
}
