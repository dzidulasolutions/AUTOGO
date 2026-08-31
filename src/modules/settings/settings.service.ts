import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../dashboard/cache.service';
import { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async get<T = unknown>(key: string): Promise<T> {
    const cached = await this.cache.get<T>(`settings:${key}`);
    if (cached !== null) return cached;

    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Parametre ${key} introuvable`);

    await this.cache.set(`settings:${key}`, setting.value, 3600);
    return setting.value as unknown as T;
  }

  async set(key: string, value: Prisma.InputJsonValue, userId: string) {
    const setting = await this.prisma.setting.upsert({
      where: { key },
      update: { value, updatedById: userId },
      create: { key, value, updatedById: userId },
    });
    await this.cache.set(`settings:${key}`, value, 3600);
    return setting;
  }

  async findAll() {
    return this.prisma.setting.findMany();
  }
}
