import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
  // OmitType retire password du lot
  // PartialType rend tous les champs de CreateUserDto optionnels (logique — pour une mise à jour, tu ne renvoies souvent qu'un ou deux champs modifiés, pas tout l'objet)
) {}
