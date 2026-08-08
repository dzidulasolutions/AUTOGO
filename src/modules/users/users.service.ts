import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // CREATE
  async create(dto: CreateUserDto) {
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
      },
    });

    return this.excludePassword(user);
  }

  // READ
  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: { role: true },
    });
    return users.map((u) => this.excludePassword(u));
  }

  // Roles
  async findAllRoles() {
    return this.prisma.role.findMany();
  }

  // READ ONE
  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return this.excludePassword(user);
  }

  // UPDATE
  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // s'assure que l'utilisateur existe et n'est pas deja supprime
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return this.excludePassword(user);
  }

  // DELETE (soft delete)
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Utilisateur desactive avec succes' };
  }

  private excludePassword(user: any) {
    const { password, ...rest } = user;
    return rest;
  }
}
