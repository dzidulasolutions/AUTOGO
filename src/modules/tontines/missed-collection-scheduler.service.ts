import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MissedCollectionSchedulerService {
  constructor(
    @InjectQueue('tontine-missed-check') private queue: Queue,
    private prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleMissedCheck() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueCollections = await this.prisma.tontineCollection.findMany({
      where: {
        status: 'A_COLLECTER',
        scheduledDate: { lt: today },
      },
      select: { id: true },
    });

    for (const collection of overdueCollections) {
      await this.queue.add('mark-missed', { collectionId: collection.id });
    }
  }
}
