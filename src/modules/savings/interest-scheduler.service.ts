import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class InterestSchedulerService {
  constructor(
    @InjectQueue('interest-calculation') private interestQueue: Queue,
    private prisma: PrismaService,
  ) {}

  // Le 1er de chaque mois a minuit
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async scheduleMonthlyInterest() {
    const activeAccounts = await this.prisma.savingsAccount.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    // Un "ticket" par compte, depose dans la file
    for (const account of activeAccounts) {
      await this.interestQueue.add('calculate-interest', {
        accountId: account.id,
      });
    }
  }
}
