import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  IsOptional,
} from 'class-validator';

export enum TransactionTypeDto {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  LOAN_DISBURSEMENT = 'LOAN_DISBURSEMENT',
  LOAN_REPAYMENT = 'LOAN_REPAYMENT',
  TONTINE_COLLECTION = 'TONTINE_COLLECTION',
  TONTINE_PAYOUT = 'TONTINE_PAYOUT',
}

export class CreateTransactionDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ enum: TransactionTypeDto })
  @IsEnum(TransactionTypeDto)
  type!: TransactionTypeDto;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "UUID genere cote client pour garantir l'idempotence",
  })
  @IsString()
  idempotencyKey!: string;
}
