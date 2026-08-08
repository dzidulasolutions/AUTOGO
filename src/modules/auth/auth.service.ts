import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { generateRefreshToken, hashToken } from './utils/token.util';
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
    return this.issueTokens(user.id, user.email, user.role.name);
  }

  private async issueTokens(
    userId: string,
    email: string,
    roleName: string,
    familyId?: string,
  ) {
    const payload = { sub: userId, email, role: roleName };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    const rawRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    await this.prisma.refreshToken.create({
      data: {
        token: hashToken(rawRefreshToken),
        userId,
        familyId: familyId ?? randomUUID(), // nouvelle famille si premiere connexion, sinon on la conserve (rotation)
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: { id: userId, email, role: roleName },
    };
  }
}
