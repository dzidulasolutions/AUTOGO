import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsUUID, IsUrl } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'Ama' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Koudjo' })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: '+22890123456' })
  @IsString()
  phone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  idDocumentUrl?: string;

  @ApiProperty({
    required: false,
    description:
      'Optionnel pour un Admin/SuperAdmin ; force sinon a l agence de l agent connecte',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    required: false,
    description:
      "Utile seulement si un Manager/Admin cree le client pour le compte d'un agent precis",
  })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;
}
