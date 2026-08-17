import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { RejectLoanDto } from './dto/reject-loan.dto';
import { formatLoanNumber } from './utils/loan-number.util';
import { FIXED_INTEREST_RATE } from './constants/loan.constants';
import { LoanFiltersDto } from './dto/loan-filters.dto';
import { TransactionsService } from '../transactions/transactions.service';

type CurrentUser = { id: string; role: string; branchId: string | null };

@Injectable()
export class LoansService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
  ) {}

  private isPrivileged(role: string): boolean {
    return ['SuperAdmin', 'Admin'].includes(role);
  }

  private checkClientAccess(
    client: { branchId: string; assignedAgentId: string | null },
    currentUser: CurrentUser,
  ) {
    if (this.isPrivileged(currentUser.role)) return;
    if (client.branchId !== currentUser.branchId) {
      throw new ForbiddenException('Client hors de votre agence');
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

  async create(dto: CreateLoanDto, currentUser: CurrentUser) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Client introuvable');
    }
    this.checkClientAccess(client, currentUser);

    const seqResult = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('loan_number_seq')
    `;
    const loanNumber = formatLoanNumber(Number(seqResult[0].nextval));

    return this.prisma.loan.create({
      data: {
        loanNumber,
        clientId: dto.clientId,
        branchId: client.branchId,
        principal: dto.principal,
        interestRate: FIXED_INTEREST_RATE, // fige au moment de la creation, jamais recalcule apres
        durationMonths: dto.durationMonths,
        frequency: dto.frequency,
        requestedById: currentUser.id,
        status: 'DRAFT',
      },
    });
  }

  async submitForApproval(loanId: string, currentUser: CurrentUser) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, status: 'DRAFT' },
      include: { client: true },
    });
    if (!loan) {
      throw new NotFoundException('Pret introuvable ou deja soumis');
    }
    this.checkClientAccess(loan.client, currentUser);

    return this.prisma.loan.update({
      where: { id: loanId },
      data: { status: 'PENDING_APPROVAL' },
    });
  }

  async approve(loanId: string, currentUser: CurrentUser) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, status: 'PENDING_APPROVAL' },
      include: { branch: true },
    });
    if (!loan) {
      throw new NotFoundException(
        "Pret introuvable ou pas en attente d'approbation",
      );
    }

    const exceedsLimit =
      Number(loan.principal) > Number(loan.branch.loanApprovalLimit);

    // Un Manager ne peut approuver que sous le plafond de l'agence ; au-dela, il faut Admin/SuperAdmin
    if (exceedsLimit && !this.isPrivileged(currentUser.role)) {
      throw new ForbiddenException(
        `Ce montant depasse le plafond de votre agence (${loan.branch.loanApprovalLimit} FCFA), un Admin doit approuver`,
      );
    }

    return this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'APPROVED',
        approvedById: currentUser.id,
        approvedAt: new Date(),
      },
    });
  }

  async reject(loanId: string, dto: RejectLoanDto, currentUser: CurrentUser) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, status: 'PENDING_APPROVAL' },
    });
    if (!loan) {
      throw new NotFoundException(
        "Pret introuvable ou pas en attente d'approbation",
      );
    }

    return this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'REJECTED',
        approvedById: currentUser.id,
        rejectionReason: dto.reason,
      },
    });
  }

  // Meme principe que ClientsService.buildScopeWhere() : Manager voit toute l'agence,
  // Agent voit uniquement les prets lies aux clients de son portefeuille
  private buildScopeWhere(currentUser: CurrentUser) {
    if (this.isPrivileged(currentUser.role)) {
      return {};
    }
    if (currentUser.role === 'Manager') {
      return { branchId: currentUser.branchId as string };
    }
    return {
      branchId: currentUser.branchId as string,
      client: { assignedAgentId: currentUser.id },
    };
  }

  private ensureHasBranchOrPrivileged(currentUser: CurrentUser): void {
    this.ensureHasBranchOrPrivileged(currentUser);
    if (!this.isPrivileged(currentUser.role) && !currentUser.branchId) {
      throw new ForbiddenException(
        "Votre compte n'est rattache a aucune agence, contactez un administrateur",
      );
    }
  }

  async findAll(currentUser: CurrentUser, filters: LoanFiltersDto) {
    const { page = 1, limit = 20, clientId, status } = filters;
    const skip = (page - 1) * limit;

    const where = {
      ...this.buildScopeWhere(currentUser),
      ...(clientId && { clientId }),
      ...(status && { status }),
    };

    const [loans, total] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        include: {
          client: {
            select: { firstName: true, lastName: true, clientNumber: true },
          },
          requestedBy: { select: { firstName: true, lastName: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.loan.count({ where }),
    ]);

    return {
      items: loans,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    this.ensureHasBranchOrPrivileged(currentUser);
    const loan = await this.prisma.loan.findFirst({
      where: { id, ...this.buildScopeWhere(currentUser) },
      include: {
        client: true,
        branch: true,
        requestedBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        schedules: { orderBy: { installmentNumber: 'asc' } },
      },
    });

    if (!loan) {
      throw new NotFoundException('Pret introuvable');
    }
    return loan;
  }

  async disburse(
    loanId: string,
    dto: { idempotencyKey: string },
    currentUser: CurrentUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, status: 'APPROVED' },
        include: { client: true },
      });

      if (!loan) {
        throw new NotFoundException('Pret introuvable ou pas approuve');
      }

      this.checkClientAccess(loan.client, currentUser);

      // Calcul de l'amortissement lineaire simple
      const principal = Number(loan.principal);
      const interestRate = Number(loan.interestRate);
      const totalInterest = principal * interestRate;
      const totalToRepay = principal + totalInterest;
      const numberOfInstallments = this.getInstallmentCount(
        loan.durationMonths,
        loan.frequency,
      );
      const installmentAmounts = this.generateInstallmentAmounts(
        totalToRepay,
        numberOfInstallments,
      );

      // Genere l'echeancier complet
      const scheduleDates = this.generateScheduleDates(
        new Date(),
        numberOfInstallments,
        loan.frequency,
        loan.allowedWeekdays,
      );
      const schedulesToCreate = scheduleDates.map((date, index) => ({
        loanId: loan.id,
        installmentNumber: index + 1,
        dueDate: date,
        amountDue: installmentAmounts[index],
      }));

      await tx.loanSchedule.createMany({ data: schedulesToCreate });

      // Transaction de decaissement : l'argent sort reellement vers le client
      const transaction = await this.transactionsService.createTransaction(
        {
          clientId: loan.clientId,
          type: 'LOAN_DISBURSEMENT' as any,
          amount: principal,
          idempotencyKey: dto.idempotencyKey,
          description: `Decaissement pret ${loan.loanNumber}`,
        },
        currentUser,
        tx,
      );

      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: { status: 'DISBURSED', disbursedAt: new Date() },
      });

      return {
        loan: updatedLoan,
        transaction,
        totalToRepay,
        amountPerInstallment: installmentAmounts[0],
        numberOfInstallments,
      };
    });
  }

  private getInstallmentCount(
    durationMonths: number,
    frequency: string,
  ): number {
    const daysMap: Record<string, number> = {
      DAILY: 30,
      WEEKLY: 4,
      MONTHLY: 1,
    };
    return durationMonths * daysMap[frequency];
  }

  private generateScheduleDates(
    startDate: Date,
    count: number,
    frequency: string,
    allowedWeekdays: number[],
  ): Date[] {
    const dates: Date[] = [];
    const cursor = new Date(startDate);

    if (frequency === 'DAILY') {
      // Avance jour par jour, ne retient que les jours autorises
      while (dates.length < count) {
        cursor.setDate(cursor.getDate() + 1);
        const isoWeekday = cursor.getDay() === 0 ? 7 : cursor.getDay();
        if (allowedWeekdays.includes(isoWeekday)) {
          dates.push(new Date(cursor));
        }
      }
    } else {
      const incrementMap: Record<string, () => void> = {
        WEEKLY: () => cursor.setDate(cursor.getDate() + 7),
        MONTHLY: () => cursor.setMonth(cursor.getMonth() + 1),
      };
      for (let i = 0; i < count; i++) {
        incrementMap[frequency]();
        dates.push(new Date(cursor));
      }
    }

    return dates;
  }

  private roundToNearestPractical(amount: number): number {
    return Math.floor(amount / 50) * 50; // toujours vers le bas, jamais au-dessus du total du
  }

  private generateInstallmentAmounts(
    totalToRepay: number,
    count: number,
  ): number[] {
    const baseAmount = this.roundToNearestPractical(totalToRepay / count);
    const amounts = new Array(count - 1).fill(baseAmount);

    const sumOfFirstInstallments = baseAmount * (count - 1);
    const lastInstallment =
      Math.round((totalToRepay - sumOfFirstInstallments) * 100) / 100;
    amounts.push(lastInstallment);

    return amounts;
  }

  // carnet de remboursement
  async getLoanSchedule(loanId: string, currentUser: CurrentUser) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, ...this.buildScopeWhere(currentUser) },
    });
    if (!loan) {
      throw new NotFoundException('Pret introuvable');
    }

    const schedules = await this.prisma.loanSchedule.findMany({
      where: { loanId },
      orderBy: { installmentNumber: 'asc' },
    });

    const paid = schedules.filter((s) => s.status === 'PAID').length;
    const overdue = schedules.filter((s) => s.status === 'OVERDUE').length;
    const pending = schedules.filter((s) => s.status === 'PENDING').length;
    const amountPaid = schedules
      .filter((s) => s.status === 'PAID')
      .reduce((sum, s) => sum + Number(s.amountDue), 0);
    const amountRemaining = schedules
      .filter((s) => s.status !== 'PAID')
      .reduce((sum, s) => sum + Number(s.amountDue), 0);

    return {
      loan: {
        loanNumber: loan.loanNumber,
        principal: loan.principal,
        status: loan.status,
      },
      progression: {
        total: schedules.length,
        paid,
        overdue,
        pending,
        amountPaid,
        amountRemaining,
      },
      schedules,
    };
  }
}
