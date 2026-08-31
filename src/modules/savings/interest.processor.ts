import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { SettingsService } from '../settings/settings.service';
import { TransactionTypeDto } from '../transactions/dto/create-transaction.dto';

@Processor('interest-calculation')
export class InterestProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private settingsService: SettingsService,
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

        const interestRate = await this.settingsService.get(
          'savings.interest_rate',
        );
        const interestAmount = Number(account.balance) * interestRate;

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
            type: TransactionTypeDto.DEPOSIT,
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
