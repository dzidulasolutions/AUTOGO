import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString } from 'class-validator';

export class SavingsOperationDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty()
  @IsString()
  idempotencyKey!: string;
}
