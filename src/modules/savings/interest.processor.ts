import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';

const INTEREST_RATE = 0.01; // 1% mensuel, exemple simple a ajuster selon les regles reelles plus tard

@Processor('interest-calculation')
export class InterestProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
  ) {
    super();
  }

  async process(job: Job<{ accountId: string }>) {
    const { accountId } = job.data;

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.savingsAccount.findFirst({
        where: { id: accountId, status: 'ACTIVE' },
      });
      if (!account) return;

      const idempotencyKey = `interest-${accountId}-${new Date().toISOString().slice(0, 7)}`;

      // Verification explicite AVANT tout effet de bord : si deja traite ce mois-ci, on sort immediatement
      const alreadyProcessed = await tx.transaction.findUnique({
        where: { idempotencyKey },
      });
      if (alreadyProcessed) {
        return; // rien a faire, ce compte a deja recu son interet ce mois-ci
      }

      const interestAmount = Number(account.balance) * INTEREST_RATE;
      if (interestAmount <= 0) return;

      const systemUser = await tx.user.findFirst({
        where: { role: { name: 'SuperAdmin' } },
      });

      await this.transactionsService.createTransaction(
        {
          clientId: account.clientId,
          type: 'DEPOSIT' as any,
          amount: interestAmount,
          idempotencyKey,
          description: 'Interet mensuel',
        },
        { id: systemUser!.id, role: 'SuperAdmin', branchId: null },
        tx,
      );

      await tx.savingsAccount.update({
        where: { id: accountId },
        data: { balance: { increment: interestAmount } },
      });
    });
  }
}
