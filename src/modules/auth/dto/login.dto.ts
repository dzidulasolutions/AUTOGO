import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'agent@autogo.tg' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'MotDePasse123!' })
  @IsString()
  password!: string;
}
