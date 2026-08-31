import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  Min,
  Max,
  IsNumber,
  Min as MinNum,
  IsOptional,
} from 'class-validator';

export class RescheduleLoanDto {
  @ApiProperty({
    example: 6,
    description: 'Nouvelle duree en mois pour le solde restant',
  })
  @IsInt()
  @Min(1)
  @Max(36)
  newDurationMonths!: number;

  @ApiProperty({
    required: false,
    example: 5000,
    description: 'Penalite de retard eventuelle, ajoutee au solde restant',
  })
  @IsOptional()
  @IsNumber()
  @MinNum(0)
  penaltyAmount?: number;
}
