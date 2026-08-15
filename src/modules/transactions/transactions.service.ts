import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { formatTransactionNumber } from './utils/transaction-number.util';
import { TransactionFiltersDto } from './dto/transaction-filters.dto';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import { Prisma } from '../../../generated/prisma/client';

type CurrentUser = { id: string; role: string; branchId: string | null };

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  private isPrivileged(role: string): boolean {
    return ['SuperAdmin', 'Admin'].includes(role);
  }

  async createTransaction(
    dto: CreateTransactionDto,
    currentUser: CurrentUser,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma; // utilise le client transactionnel fourni, sinon le client normal

    const existing = await db.transaction.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    const client = await db.client.findFirst({
      where: { id: dto.clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Client introuvable');
    }

    const targetBranchId = this.isPrivileged(currentUser.role)
      ? client.branchId
      : currentUser.branchId;

    if (!this.isPrivileged(currentUser.role)) {
      if (client.branchId !== currentUser.branchId) {
        throw new ForbiddenException(
          "Vous ne pouvez pas effectuer une transaction pour un client d'une autre agence",
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

    const seqResult = await db.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('transaction_number_seq')
  `;
    const transactionNumber = formatTransactionNumber(
      Number(seqResult[0].nextval),
    );

    return db.transaction.create({
      data: {
        transactionNumber,
        type: dto.type,
        amount: dto.amount,
        clientId: dto.clientId,
        branchId: targetBranchId!,
        performedById: currentUser.id,
        idempotencyKey: dto.idempotencyKey,
        description: dto.description,
      },
    });
  }

  async findAll(currentUser: CurrentUser, filters: TransactionFiltersDto) {
    const privileged = this.isPrivileged(currentUser.role);
    const { page = 1, limit = 20, clientId, type, fromDate, toDate } = filters;
    const skip = (page - 1) * limit;

    const where = {
      ...(!privileged && { branchId: currentUser.branchId as string }),
      ...(clientId && { clientId }),
      ...(type && { type }),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate && { gte: new Date(fromDate) }),
              ...(toDate && { lte: new Date(toDate) }),
            },
          }
        : {}),
    };

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          client: true,
          performedBy: { select: { firstName: true, lastName: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: transactions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async cancelTransaction(
    id: string,
    dto: CancelTransactionDto,
    currentUser: CurrentUser,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction introuvable');
    }

    if (transaction.status === 'CANCELLED') {
      throw new BadRequestException('Cette transaction est deja annulee');
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: currentUser.id,
        description: transaction.description
          ? `${transaction.description} | Annulee: ${dto.reason}`
          : `Annulee: ${dto.reason}`,
      },
    });
  }
}
