import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { formatClientNumber } from './utils/client-number.util';
import { Prisma } from '../../../generated/prisma/client';

type CurrentUser = { id: string; role: string; branchId: string | null };

interface ClientSearchResult {
  id: string;
  clientNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  relevance: number;
}

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  private isPrivileged(role: string): boolean {
    return ['SuperAdmin', 'Admin'].includes(role);
  }

  private ensureHasBranchOrPrivileged(currentUser: CurrentUser): void {
    if (!this.isPrivileged(currentUser.role) && !currentUser.branchId) {
      throw new ForbiddenException(
        "Votre compte n'est rattache a aucune agence, contactez un administrateur",
      );
    }
  }

  // Centralise la regle a trois niveaux : privilegie (tout voit), Manager (toute l'agence), Agent (ses clients uniquement)
  private buildScopeWhere(currentUser: CurrentUser) {
    if (this.isPrivileged(currentUser.role)) {
      return {};
    }
    if (currentUser.role === 'Manager') {
      return { branchId: currentUser.branchId as string };
    }
    return {
      branchId: currentUser.branchId as string,
      assignedAgentId: currentUser.id,
    };
  }

  async create(dto: CreateClientDto, currentUser: CurrentUser) {
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

    const result = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('client_number_seq')
    `;
    const sequenceValue = Number(result[0].nextval);
    const clientNumber = formatClientNumber(branch.code, sequenceValue);

    return this.prisma.client.create({
      data: {
        clientNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        photoUrl: dto.photoUrl,
        idDocumentUrl: dto.idDocumentUrl,
        branchId: targetBranchId,
        assignedAgentId:
          currentUser.role === 'Agent' ? currentUser.id : dto.assignedAgentId,
      },
    });
  }

  async findAll(
    currentUser: CurrentUser,
    pagination: { page: number; limit: number },
  ) {
    this.ensureHasBranchOrPrivileged(currentUser);
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const where = { deletedAt: null, ...this.buildScopeWhere(currentUser) };

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        include: { branch: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      items: clients,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    this.ensureHasBranchOrPrivileged(currentUser);
    const where = { id, deletedAt: null, ...this.buildScopeWhere(currentUser) };

    const client = await this.prisma.client.findFirst({
      where,
      include: {
        branch: true,
        // TODO Phase 6/7 : ajouter ici { tontineCycles: true, loans: true } une fois ces modules construits
      },
    });

    if (!client) {
      throw new NotFoundException('Client introuvable');
    }
    return client;
  }

  async update(id: string, dto: UpdateClientDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser); // applique deja le scoping et leve 404 si hors perimetre
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);
    await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Client desactive avec succes' };
  }

  // Reutilisable par les futurs modules Loans/Savings pour bloquer une operation sensible
  async isProfileComplete(clientId: string): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Client introuvable');
    }
    return Boolean(client.photoUrl && client.idDocumentUrl);
  }

  async search(
    query: string,
    currentUser: CurrentUser,
  ): Promise<ClientSearchResult[]> {
    this.ensureHasBranchOrPrivileged(currentUser);
    const privileged = this.isPrivileged(currentUser.role);

    // Construit la condition d'agence uniquement si necessaire, sinon un fragment SQL vide
    const branchCondition = privileged
      ? Prisma.empty
      : Prisma.sql`AND "branchId" = ${currentUser.branchId}`;

    const results = await this.prisma.$queryRaw<ClientSearchResult[]>`
    SELECT *,
      GREATEST(
        similarity("firstName", ${query}),
        similarity("lastName", ${query}),
        similarity(phone, ${query}),
        similarity("clientNumber", ${query})
      ) AS relevance
    FROM clients
    WHERE "deletedAt" IS NULL
    ${branchCondition}
    AND (
      "firstName" % ${query}
      OR "lastName" % ${query}
      OR phone % ${query}
      OR "clientNumber" % ${query}
    )
    ORDER BY relevance DESC
    LIMIT 20
  `;

    return results;
  }
}
