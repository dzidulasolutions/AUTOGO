import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { formatCycleNumber } from './utils/cycle-number.util';
import { generatePassbookPdf } from '../notifications/generators/passbook.generator';

type CurrentUser = { id: string; role: string; branchId: string | null };

@Injectable()
export class TontinesService {
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

  async createCycle(dto: CreateCycleDto, currentUser: CurrentUser) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Client introuvable');
    }
    this.checkClientAccess(client, currentUser);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + dto.durationMonths);

    const seqResult = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('tontine_cycle_number_seq')
    `;
    const cycleNumber = formatCycleNumber(Number(seqResult[0].nextval));

    // Creation du cycle ET generation du calendrier dans le meme bloc atomique :
    // un cycle ne doit jamais exister sans son calendrier complet
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.tontineCycle.create({
        data: {
          cycleNumber,
          clientId: dto.clientId,
          branchId: client.branchId,
          amountPerCollection: dto.amountPerCollection,
          durationMonths: dto.durationMonths,
          startDate,
          endDate,
          allowedWeekdays: dto.allowedWeekdays,
        },
      });

      // Genere une ligne TontineCollection pour chaque jour autorise entre startDate et endDate
      const collectionsToCreate: { cycleId: string; scheduledDate: Date }[] =
        [];
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        const isoWeekday = cursor.getDay() === 0 ? 7 : cursor.getDay(); // JS: dimanche=0, on convertit en 7
        if (dto.allowedWeekdays.includes(isoWeekday)) {
          collectionsToCreate.push({
            cycleId: cycle.id,
            scheduledDate: new Date(cursor),
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      await tx.tontineCollection.createMany({ data: collectionsToCreate });

      return { cycle, totalCollectionsGenerated: collectionsToCreate.length };
    });
  }

  async validateCollection(
    collectionId: string,
    dto: { idempotencyKey: string },
    currentUser: CurrentUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const collection = await tx.tontineCollection.findFirst({
        where: { id: collectionId },
        include: { cycle: { include: { client: true } } },
      });

      if (!collection) {
        throw new NotFoundException('Echeance introuvable');
      }

      if (collection.status === 'COLLECTE') {
        throw new BadRequestException('Cette echeance a deja ete collectee');
      }

      this.checkClientAccess(collection.cycle.client, currentUser);

      const transaction = await this.transactionsService.createTransaction(
        {
          clientId: collection.cycle.clientId,
          type: 'TONTINE_COLLECTION' as any,
          amount: Number(collection.cycle.amountPerCollection),
          idempotencyKey: dto.idempotencyKey,
          description: `Collecte tontine ${collection.cycle.cycleNumber} - echeance du ${collection.scheduledDate.toISOString().slice(0, 10)}`,
        },
        currentUser,
        tx,
      );

      const updatedCollection = await tx.tontineCollection.update({
        where: { id: collectionId },
        data: {
          status: 'COLLECTE',
          collectedAt: new Date(), // toujours la date REELLE, meme si c'est un rattrapage d'un jour marque MANQUE
          transactionId: transaction.id,
          collectedById: currentUser.id,
        },
      });

      return { transaction, collection: updatedCollection };
    });
  }

  async closeCycle(
    cycleId: string,
    dto: { idempotencyKey: string },
    currentUser: CurrentUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.tontineCycle.findFirst({
        where: { id: cycleId, status: 'ACTIVE' },
        include: { client: true },
      });

      if (!cycle) {
        throw new NotFoundException('Cycle introuvable ou deja cloture');
      }

      this.checkClientAccess(cycle.client, currentUser);

      // Calcule le total reellement collecte (uniquement les echeances COLLECTE)
      const collectedSum = await tx.tontineCollection.aggregate({
        where: { cycleId, status: 'COLLECTE' },
        _count: { id: true },
      });

      const totalCollected =
        collectedSum._count.id * Number(cycle.amountPerCollection);
      const commission = totalCollected * Number(cycle.commissionRate);
      const restitutionAmount = totalCollected - commission;

      if (restitutionAmount <= 0) {
        throw new BadRequestException(
          'Aucun montant a restituer pour ce cycle',
        );
      }

      const transaction = await this.transactionsService.createTransaction(
        {
          clientId: cycle.clientId,
          type: 'TONTINE_PAYOUT' as any,
          amount: restitutionAmount,
          idempotencyKey: dto.idempotencyKey,
          description: `Restitution cycle ${cycle.cycleNumber} (${collectedSum._count.id} collectes, commission ${(Number(cycle.commissionRate) * 100).toFixed(0)}%)`,
        },
        currentUser,
        tx,
      );

      const closedCycle = await tx.tontineCycle.update({
        where: { id: cycleId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });

      return {
        transaction,
        cycle: closedCycle,
        totalCollected,
        commission,
        restitutionAmount,
      };
    });
  }

  async getCycleCollections(cycleId: string, currentUser: CurrentUser) {
    const cycle = await this.prisma.tontineCycle.findFirst({
      where: { id: cycleId },
      include: { client: true },
    });

    if (!cycle) {
      throw new NotFoundException('Cycle introuvable');
    }

    this.checkClientAccess(cycle.client, currentUser);

    const collections = await this.prisma.tontineCollection.findMany({
      where: { cycleId },
      orderBy: { scheduledDate: 'asc' },
    });

    // Resume de progression, dans l'esprit du "carnet numerique" defini en Phase 4
    const collected = collections.filter((c) => c.status === 'COLLECTE').length;
    const missed = collections.filter((c) => c.status === 'MANQUE').length;
    const pending = collections.filter(
      (c) => c.status === 'A_COLLECTER',
    ).length;

    return {
      cycle: {
        cycleNumber: cycle.cycleNumber,
        amountPerCollection: cycle.amountPerCollection,
        status: cycle.status,
      },
      progression: {
        total: collections.length,
        collected,
        missed,
        pending,
        amountCollected: collected * Number(cycle.amountPerCollection),
      },
      collections,
    };
  }

  async generatePassbookPdf(
    cycleId: string,
    currentUser: CurrentUser,
  ): Promise<Buffer> {
    const data = await this.getCycleCollections(cycleId, currentUser); // reutilise ce qu'on a deja

    return generatePassbookPdf({
      title: `Carnet Tontine ${data.cycle.cycleNumber}`,
      clientName: '', // a completer si besoin, getCycleCollections ne renvoie pas le nom actuellement
      entries: data.collections.map((c) => ({
        label: new Date(c.scheduledDate).toLocaleDateString('fr-FR'),
        amount: Number(data.cycle.amountPerCollection),
        status: c.status,
      })),
      summary: {
        total: data.progression.total,
        completed: data.progression.collected,
        pending: data.progression.pending,
        amountDone: data.progression.amountCollected,
      },
    });
  }
}
