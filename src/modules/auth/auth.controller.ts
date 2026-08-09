import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion utilisateur' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraichir les tokens' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
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
  sendVerification(@Req() req) {
    return this.authService.sendEmailVerification(req.user.id);
  }

  @Post('verify-email')
  @ApiOperation({ summary: "Verifier l'email avec le code recu" })
  verifyEmail(@Req() req, @Body() dto: { code: string }) {
    return this.authService.verifyEmail(req.user.id, dto.code);
  }

  @Post('send-phone-verification')
  @ApiOperation({ summary: 'Envoyer un code de verification par telephone' })
  sendPhoneVerification(@Req() req) {
    return this.authService.sendPhoneVerification(req.user.id);
  }

  @Post('verify-phone')
  @ApiOperation({ summary: 'Verifier le telephone avec le code recu' })
  verifyPhone(@Req() req, @Body() dto: { code: string }) {
    return this.authService.verifyPhone(req.user.id, dto.code);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Demander une reinitialisation de mot de passe' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reinitialiser le mot de passe avec un code' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }
}
