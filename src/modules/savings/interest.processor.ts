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

    try {
      await this.prisma.$transaction(async (tx) => {
        const account = await tx.savingsAccount.findFirst({
          where: { id: accountId, status: 'ACTIVE' },
        });
        if (!account) {
          console.log(`Compte ${accountId} introuvable ou inactif, job ignore`);
          return;
        }

        const idempotencyKey = `interest-${accountId}-${new Date().toISOString().slice(0, 7)}`;

        const alreadyProcessed = await tx.transaction.findUnique({
          where: { idempotencyKey },
        });
        if (alreadyProcessed) {
          console.log(`Compte ${accountId} deja traite ce mois-ci, job ignore`);
          return;
        }

        const interestAmount = Number(account.balance) * INTEREST_RATE;
        if (interestAmount <= 0) {
          console.log(
            `Compte ${accountId} solde nul ou negatif, pas d'interet`,
          );
          return;
        }

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
        console.log(
          `Compte ${accountId} : interet de ${interestAmount} applique`,
        );
      });
    } catch (error) {
      console.error(
        `Erreur traitement interet pour compte ${accountId}:`,
        error,
      );
      // On ne relance pas l'erreur : ce job individuel echoue, mais les autres tickets de la file continuent normalement
    }
  }
}
