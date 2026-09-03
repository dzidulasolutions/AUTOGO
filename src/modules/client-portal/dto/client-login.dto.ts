import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ClientLoginDto {
  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
