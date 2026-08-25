import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { OpenAccountDto } from './dto/open-account.dto';
import { SavingsOperationDto } from './dto/savings-operation.dto';
import { formatSavingsAccountNumber } from './utils/savings-number.util';
import { SettingsService } from '../settings/settings.service';

type CurrentUser = { id: string; role: string; branchId: string | null };

@Injectable()
export class SavingsService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
  ) {}

  private isPrivileged(role: string): boolean {
    return ['SuperAdmin', 'Admin'].includes(role);
  }

  async openAccount(dto: OpenAccountDto, currentUser: CurrentUser) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Client introuvable');
    }

    if (!this.isPrivileged(currentUser.role)) {
      if (client.branchId !== currentUser.branchId) {
        throw new ForbiddenException(
          "Vous ne pouvez pas ouvrir un compte pour un client d'une autre agence",
        );
      }
      if (
        currentUser.role === 'Agent' &&
        client.assignedAgentId !== currentUser.id
      ) {
        throw new ForbiddenException(
          "Ce client n'est pas assigne a votre portefeuille",
        );
      }
    }

    const seqResult = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('savings_account_number_seq')
    `;
    const accountNumber = formatSavingsAccountNumber(
      Number(seqResult[0].nextval),
    );

    return this.prisma.savingsAccount.create({
      data: {
        accountNumber,
        clientId: dto.clientId,
        branchId: client.branchId,
        balance: 0,
      },
    });
  }

  async deposit(
    accountId: string,
    dto: SavingsOperationDto,
    currentUser: CurrentUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.savingsAccount.findFirst({
        where: { id: accountId, status: 'ACTIVE' },
      });
      if (!account) {
        throw new NotFoundException('Compte epargne introuvable ou ferme');
      }

      const transaction = await this.transactionsService.createTransaction(
        {
          clientId: account.clientId,
          type: 'DEPOSIT' as any,
          amount: dto.amount,
          idempotencyKey: dto.idempotencyKey,
          description: `Depot sur compte ${account.accountNumber}`,
        },
        currentUser,
        tx,
      );

      const updatedAccount = await tx.savingsAccount.update({
        where: { id: accountId },
        data: { balance: { increment: dto.amount } },
      });

      return { transaction, account: updatedAccount };
    });
  }

  async withdraw(
    accountId: string,
    dto: SavingsOperationDto,
    currentUser: CurrentUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // $queryRaw avec FOR UPDATE : verrouille la ligne jusqu'a la fin de cette transaction
      const accounts = await tx.$queryRaw<any[]>`
      SELECT * FROM savings_accounts
      WHERE id = ${accountId} AND status = 'ACTIVE'
      FOR UPDATE
    `;
      const account = accounts[0];

      if (!account) {
        throw new NotFoundException('Compte epargne introuvable ou ferme');
      }

      // account.balance vient du SQL brut : c'est une string, pas un objet Decimal Prisma
      if (Number(account.balance) < dto.amount) {
        throw new BadRequestException('Solde insuffisant pour ce retrait');
      }

      const transaction = await this.transactionsService.createTransaction(
        {
          clientId: account.clientId,
          type: 'WITHDRAWAL' as any,
          amount: dto.amount,
          idempotencyKey: dto.idempotencyKey,
          description: `Retrait sur compte ${account.accountNumber}`,
        },
        currentUser,
        tx,
      );

      const updatedAccount = await tx.savingsAccount.update({
        where: { id: accountId },
        data: { balance: { decrement: dto.amount } },
      });

      return { transaction, account: updatedAccount };
    });
  }
}
