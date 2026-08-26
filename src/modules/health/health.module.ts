import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TerminusModule,
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
