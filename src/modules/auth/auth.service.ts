import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { generateRefreshToken, hashToken } from './utils/token.util';
import * as argon2 from 'argon2';
import { MockNotificationAdapter } from './adapters/mock-notification.adapter';
import { generateSecret, verify, generateURI } from 'otplib';
import * as qrcode from 'qrcode';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,

    private notificationAdapter: MockNotificationAdapter,
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

  async login(
    email: string,
    password: string,
    metadata: { userAgent?: string; ipAddress?: string },
    mfaCode?: string,
  ) {
    const user = await this.validateUser(email, password);

    if (user.mfaEnabled) {
      if (!mfaCode) {
        return { mfaRequired: true };
      }

      const result = await verify({ secret: user.mfaSecret!, token: mfaCode });
      if (!result.valid) {
        throw new UnauthorizedException('Code MFA invalide');
      }
    }

    return this.issueTokens(user.id, user.email, user.role.name, metadata);
  }

  private async issueTokens(
    userId: string,
    email: string,
    roleName: string,
    metadata: { userAgent?: string; ipAddress?: string },
    familyId?: string,
  ) {
    const payload = { sub: userId, email, role: roleName };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    const rawRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const refreshTokenRecord = await this.prisma.refreshToken.create({
      data: {
        token: hashToken(rawRefreshToken),
        userId,
        familyId: familyId ?? randomUUID(),
        expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      sessionId: refreshTokenRecord.id, // utile pour identifier "la session courante" cote frontend
      user: { id: userId, email, role: roleName },
    };
  }

  async refresh(
    rawToken: string,
    metadata: { userAgent?: string; ipAddress?: string },
  ) {
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
      metadata,
      existingToken.familyId,
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

  async sendEmailVerification(userId: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // code a 6 chiffres
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { verificationCode: code, verificationCodeExpiresAt: expiresAt },
    });

    await this.notificationAdapter.sendVerificationCode(user.email, code);

    return { message: 'Code de verification envoye' };
  }

  async verifyEmail(userId: string, code: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user || !user.verificationCode || !user.verificationCodeExpiresAt) {
      throw new BadRequestException('Aucune verification en cours');
    }

    if (user.verificationCodeExpiresAt < new Date()) {
      throw new BadRequestException('Code expire');
    }

    if (user.verificationCode !== code) {
      throw new BadRequestException('Code invalide');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
      },
    });

    return { message: 'Email verifie avec succes' };
  }

  async sendPhoneVerification(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    if (!user.phone) {
      throw new BadRequestException(
        'Aucun numero de telephone associe a ce compte',
      );
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { verificationCode: code, verificationCodeExpiresAt: expiresAt },
    });

    await this.notificationAdapter.sendVerificationCode(user.phone, code);

    return { message: 'Code de verification envoye par telephone' };
  }

  async verifyPhone(userId: string, code: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user || !user.verificationCode || !user.verificationCodeExpiresAt) {
      throw new BadRequestException('Aucune verification en cours');
    }

    if (user.verificationCodeExpiresAt < new Date()) {
      throw new BadRequestException('Code expire');
    }

    if (user.verificationCode !== code) {
      throw new BadRequestException('Code invalide');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
      },
    });

    return { message: 'Telephone verifie avec succes' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) {
      return {
        message:
          'Si ce compte existe, un code de reinitialisation a ete envoye',
      };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes, plus court qu'avant car plus facile a deviner par force brute

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashToken(code),
        resetPasswordExpiresAt: expiresAt,
      },
    });

    await this.notificationAdapter.sendVerificationCode(user.email, code);

    return {
      message: 'Si ce compte existe, un code de reinitialisation a ete envoye',
    };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        resetPasswordToken: hashToken(code),
        deletedAt: null,
      },
    });

    if (!user || !user.resetPasswordExpiresAt) {
      throw new BadRequestException('Code de reinitialisation invalide');
    }

    if (user.resetPasswordExpiresAt < new Date()) {
      throw new BadRequestException('Code de reinitialisation expire');
    }

    const hashedPassword = await argon2.hash(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    });

    return { message: 'Mot de passe reinitialise avec succes' };
  }

  async getSessions(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId, revoked: false, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return sessions;
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable');
    }

    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revoked: true },
    });

    return { message: 'Session revoquee avec succes' };
  }

  async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revoked: false,
        id: { not: currentSessionId },
      },
      data: { revoked: true },
    });
    return { message: 'Toutes les autres sessions ont ete revoquees' };
  }

  async generateMfaSecret(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: 'AuTogo',
      label: user.email,
      secret,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return { qrCodeDataUrl, secret };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('Aucune configuration MFA en cours');
    }

    const result = await verify({ secret: user.mfaSecret, token: code });
    if (!result.valid) {
      throw new BadRequestException('Code invalide');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { message: 'MFA active avec succes' };
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA non configure');
    }

    const result = await verify({ secret: user.mfaSecret, token: code });
    if (!result.valid) {
      throw new BadRequestException('Code invalide');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    return { message: 'MFA desactive' };
  }
}
