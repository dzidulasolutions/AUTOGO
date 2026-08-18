import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';

@Processor('loan-overdue-check')
export class OverdueProcessor extends WorkerHost {
  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ scheduleId: string }>) {
    const { scheduleId } = job.data;

    try {
      // Meme protection qu'en Phase 6 : n'ecrase jamais un paiement valide entre-temps
      await this.prisma.loanSchedule.updateMany({
        where: { id: scheduleId, status: 'PENDING' },
        data: { status: 'OVERDUE' },
      });
    } catch (error) {
      console.error(
        `Erreur marquage retard pour echeance ${scheduleId}:`,
        error,
      );
    }
  }
}
