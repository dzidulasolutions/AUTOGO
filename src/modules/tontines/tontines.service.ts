import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { randomUUID } from 'crypto';
import { formatCycleNumber } from './utils/cycle-number.util';

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
}
