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

  async refresh(rawToken: string) {
    const hashedToken = hashToken(rawToken);

    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: { include: { role: true } } },
    });

    if (!existingToken) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    // Detection de reutilisation : ce token a deja ete consomme une fois
    if (existingToken.revoked) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existingToken.familyId },
        data: { revoked: true },
      });
      throw new UnauthorizedException(
        'Session compromise detectee, toutes les sessions ont ete revoquees',
      );
    }

    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expire');
    }

    // Rotation : on revoque l'ancien avant d'en emettre un nouveau
    await this.prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revoked: true },
    });

    return this.issueTokens(
      existingToken.user.id,
      existingToken.user.email,
      existingToken.user.role.name,
      existingToken.familyId, // meme famille conservee
    );
  }

  async logout(rawToken: string) {
    const hashedToken = hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { token: hashedToken },
      data: { revoked: true },
    });
    return { message: 'Deconnexion reussie' };
  }
}
