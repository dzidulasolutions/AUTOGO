import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { generateReceiptPdf } from '../generators/receipt.generator';
import { UploadsService } from '../../uploads/uploads.service';

@Processor('pdf')
export class ReceiptProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private uploadsService: UploadsService,
  ) {
    super();
  }

  async process(job: Job<{ transactionId: string }>) {
    if (job.name !== 'generate-receipt') return;

    const { transactionId } = job.data;

    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { client: true, branch: true, performedBy: true },
      });

      if (!transaction) {
        console.error(
          `Transaction ${transactionId} introuvable pour generation de recu`,
        );
        return;
      }

      const pdfBuffer = await generateReceiptPdf({
        transactionNumber: transaction.transactionNumber,
        type: transaction.type,
        amount: Number(transaction.amount),
        clientName: `${transaction.client.firstName} ${transaction.client.lastName}`,
        clientNumber: transaction.client.clientNumber,
        branchName: transaction.branch.name,
        performedByName: `${transaction.performedBy.firstName} ${transaction.performedBy.lastName}`,
        createdAt: transaction.createdAt,
      });

      const fakeFile = {
        buffer: pdfBuffer,
        mimetype: 'application/pdf',
        originalname: `recu-${transaction.transactionNumber}.pdf`,
      } as Express.Multer.File;

      const receiptUrl = await this.uploadsService.uploadFile(fakeFile);

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { receiptUrl },
      });

      console.log(
        `Recu genere et uploade pour ${transaction.transactionNumber}`,
      );
    } catch (error) {
      console.error(
        `Erreur generation recu pour transaction ${transactionId}:`,
        error,
      );
    }
  }
}
