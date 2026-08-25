import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../dashboard/cache.service';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async get(key: string): Promise<any> {
    const cached = await this.cache.get(`settings:${key}`);
    if (cached !== null) return cached;

    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Parametre ${key} introuvable`);

    await this.cache.set(`settings:${key}`, setting.value, 3600);
    return setting.value;
  }

  async set(key: string, value: any, userId: string) {
    const setting = await this.prisma.setting.upsert({
      where: { key },
      update: { value, updatedById: userId },
      create: { key, value, updatedById: userId },
    });
    await this.cache.set(`settings:${key}`, value, 3600); // invalide en ecrasant directement
    return setting;
  }

  async findAll() {
    return this.prisma.setting.findMany();
  }
}
