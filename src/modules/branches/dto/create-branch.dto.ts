import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'Agence Lome Centre' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'LOM-01' })
  @IsString()
  code!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Lome' })
  @IsString()
  city!: string;
}
