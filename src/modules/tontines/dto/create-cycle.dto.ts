import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class CreateCycleDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @IsPositive()
  amountPerCollection!: number;

  @ApiProperty({ example: 3, description: 'Duree en mois, 1 a 12' })
  @IsInt()
  @Min(1)
  @Max(12)
  durationMonths!: number;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    example: [1, 2, 3, 4, 5],
    description: '1=lundi ... 7=dimanche',
  })
  @IsArray()
  @ArrayMinSize(1)
  allowedWeekdays!: number[];
}
