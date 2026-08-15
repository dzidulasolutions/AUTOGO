import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { TontinesController } from './tontines.controller';
import { TontinesService } from './tontines.service';

@Module({
  imports: [TransactionsModule],
  controllers: [TontinesController],
  providers: [TontinesService],
})
export class TontinesModule {}
