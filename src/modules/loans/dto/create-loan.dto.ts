import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsArray,
} from 'class-validator';

export enum LoanFrequencyDto {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export class CreateLoanDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: 100000 })
  @IsNumber()
  @IsPositive()
  principal!: number;

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  @Max(36)
  durationMonths!: number;

  @ApiProperty({ enum: LoanFrequencyDto })
  @IsEnum(LoanFrequencyDto)
  frequency!: LoanFrequencyDto;

  @ApiProperty({
    required: false,
    example: [1, 2, 3, 4, 5],
    description:
      'Jours autorises pour frequence DAILY, lundi-vendredi par defaut',
  })
  @IsOptional()
  @IsArray()
  allowedWeekdays?: number[];
}
