import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OverdueSchedulerService {
  constructor(
    @InjectQueue('loan-overdue-check') private queue: Queue,
    private prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleOverdueCheck() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueSchedules = await this.prisma.loanSchedule.findMany({
      where: { status: 'PENDING', dueDate: { lt: today } },
      select: { id: true },
    });

    for (const schedule of overdueSchedules) {
      await this.queue.add('mark-overdue', { scheduleId: schedule.id });
    }
  }
}
