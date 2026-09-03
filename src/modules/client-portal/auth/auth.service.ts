import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../../database/prisma.service';
import { ActivateClientDto } from '../dto/activate.dto';
import { ClientLoginDto } from '../dto/client-login.dto';

@Injectable()
export class ClientAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async activate(dto: ActivateClientDto) {
    const client = await this.prisma.client.findFirst({
      where: { phone: dto.phone, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException(
        'Aucun client trouve avec ce numero de telephone',
      );
    }

    if (client.password) {
      throw new ConflictException('Ce compte est deja active');
    }

    // Si un email est deja enregistre pour ce client, il doit correspondre exactement
    // (verification d'identite minimale, sans code OTP complet)
    if (
      client.email &&
      client.email.toLowerCase() !== dto.email.toLowerCase()
    ) {
      throw new BadRequestException(
        "L'email ne correspond pas a celui enregistre pour ce client, contactez votre agent",
      );
    }

    // Empeche qu'un autre client active deja utilise le meme email
    const emailAlreadyUsed = await this.prisma.client.findFirst({
      where: {
        email: dto.email,
        password: { not: null }, // deja active
        id: { not: client.id },
      },
    });
    if (emailAlreadyUsed) {
      throw new ConflictException(
        'Cet email est deja utilise par un autre compte active',
      );
    }

    const hashedPassword = await argon2.hash(dto.password);

    await this.prisma.client.update({
      where: { id: client.id },
      data: { email: dto.email, password: hashedPassword },
    });

    return {
      message:
        'Compte active avec succes, vous pouvez maintenant vous connecter',
    };
  }

  async login(dto: ClientLoginDto) {
    const client = await this.prisma.client.findFirst({
      where: { phone: dto.phone, deletedAt: null },
    });

    if (!client || !client.password) {
      throw new UnauthorizedException(
        'Identifiants invalides ou compte non active',
      );
    }

    const passwordValid = await argon2.verify(client.password, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const accessToken = this.jwtService.sign(
      { sub: client.id, phone: client.phone, type: 'client' },
      { expiresIn: '1h' },
    );

    return {
      accessToken,
      client: {
        id: client.id,
        clientNumber: client.clientNumber,
        firstName: client.firstName,
        lastName: client.lastName,
      },
    };
  }
}
