import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';
import { User } from 'generated/prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';

type CurrentUser = { id: string; role: string; branchId: string | null };
type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
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

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Un utilisateur avec cet email existe deja');
    }

    const hashedPassword = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: dto.roleId,
        branchId: dto.branchId,
      },
    });

    return this.excludePassword(user);
  }

  async findAll(currentUser: CurrentUser): Promise<SafeUser[]> {
    this.ensureHasBranchOrPrivileged(currentUser);
    const privileged = this.isPrivileged(currentUser.role);

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(!privileged && { branchId: currentUser.branchId }),
      },
      include: { role: true, branch: true },
    });

    return users.map((u) => this.excludePassword(u));
  }

  async findOne(id: string, currentUser: CurrentUser): Promise<SafeUser> {
    this.ensureHasBranchOrPrivileged(currentUser);
    const privileged = this.isPrivileged(currentUser.role);

    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!privileged && { branchId: currentUser.branchId }),
      },
      include: { role: true, branch: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return this.excludePassword(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    currentUser: CurrentUser,
  ): Promise<SafeUser> {
    // findOne applique deja le scoping : si l'utilisateur cible n'est pas dans le perimetre, il leve 404 ici
    await this.findOne(id, currentUser);

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return this.excludePassword(user);
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Utilisateur desactive avec succes' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { role: true, profile: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return this.excludePassword(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.birthDate) {
      data.birthDate = new Date(dto.birthDate);
    }

    return this.prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async updateContact(
    userId: string,
    dto: { email?: string; phone?: string },
  ): Promise<SafeUser> {
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: userId } },
      });
      if (existing) {
        throw new ConflictException(
          'Cet email est deja utilise par un autre compte',
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.email && { email: dto.email, emailVerified: false }),
        ...(dto.phone && { phone: dto.phone, phoneVerified: false }),
      },
    });

    return this.excludePassword(user);
  }

  async findAllRoles() {
    return this.prisma.role.findMany();
  }

  private excludePassword(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return rest;
  }
}
