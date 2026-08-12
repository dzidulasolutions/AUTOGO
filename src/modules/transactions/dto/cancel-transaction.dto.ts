import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelTransactionDto {
  @ApiProperty({ example: 'Erreur de saisie, montant incorrect' })
  @IsString()
  @MinLength(5)
  reason!: string;
}
