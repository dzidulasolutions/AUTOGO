import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
  Get,
  Delete,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../../types/express';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentatives par minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion utilisateur' })
  login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string,
  ) {
    return this.authService.login(
      dto.email,
      dto.password,
      { userAgent, ipAddress: ip },
      dto.mfaCode,
    );
  }

  @Post('mfa/setup')
  @ApiOperation({ summary: 'Generer le QR code MFA' })
  setupMfa(@CurrentUser() user: CurrentUserType) {
    return this.authService.generateMfaSecret(user.id);
  }

  @Post('mfa/enable')
  @ApiOperation({ summary: 'Activer le MFA apres verification du code' })
  enableMfa(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: { code: string },
  ) {
    return this.authService.enableMfa(user.id, dto.code);
  }

  @Post('mfa/disable')
  @ApiOperation({ summary: 'Desactiver le MFA' })
  disableMfa(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: { code: string },
  ) {
    return this.authService.disableMfa(user.id, dto.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraichir les tokens' })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string,
  ) {
    return this.authService.refresh(dto.refreshToken, {
      userAgent,
      ipAddress: ip,
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deconnexion' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('send-verification')
  @ApiOperation({ summary: 'Envoyer un code de verification email' })
  sendVerification(@CurrentUser() user: CurrentUserType) {
    return this.authService.sendEmailVerification(user.id);
  }

  @Post('verify-email')
  @ApiOperation({ summary: "Verifier l'email avec le code recu" })
  verifyEmail(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: { code: string },
  ) {
    return this.authService.verifyEmail(user.id, dto.code);
  }

  @Post('send-phone-verification')
  @ApiOperation({ summary: 'Envoyer un code de verification par telephone' })
  sendPhoneVerification(@CurrentUser() user: CurrentUserType) {
    return this.authService.sendPhoneVerification(user.id);
  }

  @Post('verify-phone')
  @ApiOperation({ summary: 'Verifier le telephone avec le code recu' })
  verifyPhone(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: { code: string },
  ) {
    return this.authService.verifyPhone(user.id, dto.code);
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 par minute, plus strict encore
  @ApiOperation({ summary: 'Demander une reinitialisation de mot de passe' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reinitialiser le mot de passe avec un code' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Lister mes sessions actives' })
  getSessions(@CurrentUser() user: CurrentUserType) {
    return this.authService.getSessions(user.id);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Revoquer une session precise' })
  revokeSession(
    @CurrentUser() user: CurrentUserType,
    @Param('id') sessionId: string,
  ) {
    return this.authService.revokeSession(user.id, sessionId);
  }

  @Delete('sessions')
  @ApiOperation({ summary: 'Revoquer toutes les sessions sauf celle en cours' })
  revokeAllOtherSessions(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: { currentSessionId: string },
  ) {
    return this.authService.revokeAllOtherSessions(
      user.id,
      dto.currentSessionId,
    );
  }
}
