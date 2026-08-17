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

type CurrentUser = { id: string; role: string; branchId: string | null };

@Injectable()
export class LoansService {
  constructor(private prisma: PrismaService) {}

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
}
