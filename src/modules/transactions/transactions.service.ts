import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { formatTransactionNumber } from './utils/transaction-number.util';
import { TransactionFiltersDto } from './dto/transaction-filters.dto';

type CurrentUser = { id: string; role: string; branchId: string | null };

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  private isPrivileged(role: string): boolean {
    return ['SuperAdmin', 'Admin'].includes(role);
  }

  async createTransaction(dto: CreateTransactionDto, currentUser: CurrentUser) {
    // 1. Verification d'idempotence AVANT toute autre logique
    const existing = await this.prisma.transaction.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      // On ne leve pas d'erreur : on renvoie simplement le resultat deja obtenu
      return existing;
    }

    // 2. Validations metier, avant d'ouvrir le bloc transactionnel
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Client introuvable');
    }

    const targetBranchId = this.isPrivileged(currentUser.role)
      ? client.branchId
      : currentUser.branchId;

    if (
      !this.isPrivileged(currentUser.role) &&
      client.branchId !== currentUser.branchId
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez pas effectuer une transaction pour un client d'une autre agence",
      );
    }

    // 3. Numerotation via sequence
    const seqResult = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('transaction_number_seq')
    `;
    const transactionNumber = formatTransactionNumber(
      Number(seqResult[0].nextval),
    );

    // 4. Creation dans un bloc transactionnel Prisma (atomicite)
    const transaction = await this.prisma.$transaction(async (tx) => {
      return tx.transaction.create({
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
    });

    return transaction;
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
}
