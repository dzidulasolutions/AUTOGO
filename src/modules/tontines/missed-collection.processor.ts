import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';

@Processor('tontine-missed-check')
export class MissedCollectionProcessor extends WorkerHost {
  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ collectionId: string }>) {
    const { collectionId } = job.data;

    try {
      // updateMany avec condition de statut : evite d'ecraser une collecte
      // validee entre le moment ou le job a ete planifie et son execution reelle
      await this.prisma.tontineCollection.updateMany({
        where: { id: collectionId, status: 'A_COLLECTER' },
        data: { status: 'MANQUE' },
      });
    } catch (error) {
      console.error(
        `Erreur marquage manque pour echeance ${collectionId}:`,
        error,
      );
    }
  }
}
