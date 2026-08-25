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
import { RescheduleLoanDto } from './dto/reschedule-loan.dto';
import { generatePassbookPdf } from '../notifications/generators/passbook.generator';
import { ResendEmailAdapter } from '../notifications/adapters/resend-email.adapter';
import { SettingsService } from '../settings/settings.service';

type CurrentUser = { id: string; role: string; branchId: string | null };

@Injectable()
export class LoansService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private emailAdapter: ResendEmailAdapter,
    private settingsService: SettingsService,
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
    const interestRate = await this.settingsService.get('loan.interest_rate');
    return this.prisma.loan.create({
      data: {
        loanNumber,
        clientId: dto.clientId,
        branchId: client.branchId,
        principal: dto.principal,
        interestRate, // fige au moment de la creation, jamais recalcule apres
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
      include: { branch: true, client: true }, // ajout de client: true, necessaire pour l'email
    });
    if (!loan) {
      throw new NotFoundException(
        "Pret introuvable ou pas en attente d'approbation",
      );
    }

    const exceedsLimit =
      Number(loan.principal) > Number(loan.branch.loanApprovalLimit);

    if (exceedsLimit && !this.isPrivileged(currentUser.role)) {
      throw new ForbiddenException(
        `Ce montant depasse le plafond de votre agence (${loan.branch.loanApprovalLimit} FCFA), un Admin doit approuver`,
      );
    }

    const updatedLoan = await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'APPROVED',
        approvedById: currentUser.id,
        approvedAt: new Date(),
      },
    });

    if (loan.client.email) {
      await this.emailAdapter.send(
        loan.client.email,
        'Votre pret a ete approuve',
        `<p>Bonjour ${loan.client.firstName},</p><p>Votre demande de pret ${loan.loanNumber} d'un montant de ${loan.principal} FCFA a ete approuvee.</p>`,
      );
    }

    return updatedLoan;
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

  // enregistrement dans transaction
  async recordRepayment(
    loanId: string,
    dto: { amount: number; idempotencyKey: string },
    currentUser: CurrentUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, status: 'DISBURSED' },
        include: { client: true },
      });
      if (!loan) {
        throw new NotFoundException('Pret introuvable ou pas decaisse');
      }
      this.checkClientAccess(loan.client, currentUser);

      // Recupere les echeances impayees, dans l'ordre chronologique (FIFO)
      const unpaidSchedules = await tx.loanSchedule.findMany({
        where: { loanId, status: { in: ['PENDING', 'OVERDUE'] } },
        orderBy: { installmentNumber: 'asc' },
      });

      if (unpaidSchedules.length === 0) {
        throw new BadRequestException('Toutes les echeances sont deja payees');
      }

      // Determine combien d'echeances completes ce montant peut couvrir, dans l'ordre
      let remainingAmount = dto.amount;
      const schedulesToPay: typeof unpaidSchedules = [];

      for (const schedule of unpaidSchedules) {
        const amountDue = Number(schedule.amountDue);
        if (remainingAmount >= amountDue) {
          schedulesToPay.push(schedule);
          remainingAmount -= amountDue;
        } else {
          break; // le montant restant ne suffit plus pour l'echeance suivante
        }
      }

      if (schedulesToPay.length === 0) {
        throw new BadRequestException(
          `Montant insuffisant pour couvrir la prochaine echeance (${unpaidSchedules[0].amountDue} FCFA requis)`,
        );
      }

      if (remainingAmount > 0) {
        throw new BadRequestException(
          `Le montant ne correspond pas exactement a un nombre entier d'echeances (surplus de ${remainingAmount} FCFA)`,
        );
      }

      const transaction = await this.transactionsService.createTransaction(
        {
          clientId: loan.clientId,
          type: 'LOAN_REPAYMENT' as any,
          amount: dto.amount,
          idempotencyKey: dto.idempotencyKey,
          description: `Remboursement pret ${loan.loanNumber} (${schedulesToPay.length} echeance(s))`,
        },
        currentUser,
        tx,
      );

      // Marque chaque echeance couverte comme payee, liee a cette transaction
      for (const schedule of schedulesToPay) {
        await tx.loanSchedule.update({
          where: { id: schedule.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            transactionId: transaction.id,
          },
        });
      }

      // Cloture automatique si c'etait la derniere echeance
      const remainingUnpaid = await tx.loanSchedule.count({
        where: { loanId, status: { in: ['PENDING', 'OVERDUE'] } },
      });
      if (remainingUnpaid === 0) {
        await tx.loan.update({
          where: { id: loanId },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
      }

      return {
        transaction,
        schedulesPaid: schedulesToPay.length,
        loanClosed: remainingUnpaid === 0,
      };
    });
  }

  // reechelonnage
  async reschedule(
    loanId: string,
    dto: RescheduleLoanDto,
    currentUser: CurrentUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, status: 'DISBURSED' },
        include: { client: true },
      });
      if (!loan) {
        throw new NotFoundException('Pret introuvable ou pas decaisse');
      }
      this.checkClientAccess(loan.client, currentUser);

      const unpaidSchedules = await tx.loanSchedule.findMany({
        where: { loanId, status: { in: ['PENDING', 'OVERDUE'] } },
      });

      if (unpaidSchedules.length === 0) {
        throw new BadRequestException(
          'Aucune echeance restante a reechelonner',
        );
      }

      const remainingAmount = unpaidSchedules.reduce(
        (sum, s) => sum + Number(s.amountDue),
        0,
      );
      const newTotal = remainingAmount + (dto.penaltyAmount ?? 0);

      // Determine le nombre de nouvelles echeances selon la frequence existante du pret
      const newInstallmentCount = this.getInstallmentCount(
        dto.newDurationMonths,
        loan.frequency,
      );
      const newInstallmentAmounts = this.generateInstallmentAmounts(
        newTotal,
        newInstallmentCount,
      );
      const newScheduleDates = this.generateScheduleDates(
        new Date(),
        newInstallmentCount,
        loan.frequency,
        loan.allowedWeekdays,
      );

      // Annule les anciennes echeances non payees, sans les supprimer (historique preserve)
      await tx.loanSchedule.updateMany({
        where: { id: { in: unpaidSchedules.map((s) => s.id) } },
        data: { status: 'CANCELLED' },
      });

      // Determine le prochain numero d'echeance a utiliser, pour ne pas entrer en conflit avec les anciennes
      const maxInstallmentNumber = await tx.loanSchedule.aggregate({
        where: { loanId },
        _max: { installmentNumber: true },
      });
      const startingNumber =
        (maxInstallmentNumber._max.installmentNumber ?? 0) + 1;

      const newSchedulesToCreate = newScheduleDates.map((date, index) => ({
        loanId,
        installmentNumber: startingNumber + index,
        dueDate: date,
        amountDue: newInstallmentAmounts[index],
      }));

      await tx.loanSchedule.createMany({ data: newSchedulesToCreate });

      return {
        cancelledSchedules: unpaidSchedules.length,
        newSchedulesCreated: newSchedulesToCreate.length,
        newTotal,
        penaltyApplied: dto.penaltyAmount ?? 0,
      };
    });
  }

  async generatePassbookPdf(
    loanId: string,
    currentUser: CurrentUser,
  ): Promise<Buffer> {
    const data = await this.getLoanSchedule(loanId, currentUser); // reutilise ce qu'on a deja construit

    return generatePassbookPdf({
      title: `Echeancier Pret ${data.loan.loanNumber}`,
      clientName: '', // getLoanSchedule ne renvoie pas le nom du client actuellement, laisse vide pour l'instant
      entries: data.schedules.map((s) => ({
        label: `Echeance ${s.installmentNumber} - ${new Date(s.dueDate).toLocaleDateString('fr-FR')}`,
        amount: Number(s.amountDue),
        status: s.status,
      })),
      summary: {
        total: data.progression.total,
        completed: data.progression.paid,
        pending: data.progression.pending,
        amountDone: data.progression.amountPaid,
      },
    });
  }
}
