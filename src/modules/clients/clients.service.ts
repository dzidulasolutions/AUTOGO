import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { formatClientNumber } from './utils/client-number.util';

type CurrentUser = { id: string; role: string; branchId: string | null };

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  private isPrivileged(role: string): boolean {
    return ['SuperAdmin', 'Admin'].includes(role);
  }

  async create(dto: CreateClientDto, currentUser: CurrentUser) {
    // Determine l'agence cible : celle de l'agent connecte, ou celle fournie explicitement si privilegie
    const targetBranchId = this.isPrivileged(currentUser.role)
      ? dto.branchId
      : currentUser.branchId;

    if (!targetBranchId) {
      throw new BadRequestException(
        'Aucune agence determinee pour ce client (branchId requis pour un Admin/SuperAdmin)',
      );
    }

    const existingPhone = await this.prisma.client.findFirst({
      where: { phone: dto.phone, deletedAt: null },
    });
    if (existingPhone) {
      throw new ConflictException(
        'Un client avec ce numero de telephone existe deja',
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: targetBranchId, deletedAt: null },
    });
    if (!branch) {
      throw new NotFoundException('Agence introuvable');
    }

    // Recupere la prochaine valeur de la sequence PostgreSQL de facon atomique
    const result = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('client_number_seq')
    `;
    const sequenceValue = Number(result[0].nextval);
    const clientNumber = formatClientNumber(branch.code, sequenceValue);

    const client = await this.prisma.client.create({
      data: {
        clientNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        branchId: targetBranchId,
      },
    });

    return client;
  }
}
