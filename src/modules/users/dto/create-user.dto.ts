import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsUUID } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'agent@autogo.tg' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'MotDePasseSecurise123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Koffi' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Mensah' })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: 'uuid-du-role' })
  @IsUUID()
  roleId!: string;

  @ApiProperty({ example: 'uuid-de-l-agence' })
  @IsUUID()
  branchId!: string;
}
