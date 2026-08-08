import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordValid = await argon2.verify(user.password, password);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
      },
    };
  }
}