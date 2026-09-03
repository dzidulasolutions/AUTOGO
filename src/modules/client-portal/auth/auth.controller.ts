import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ActivateClientDto } from '../dto/activate.dto';
import { ClientLoginDto } from '../dto/client-login.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { ClientAuthService } from './auth.service';

@ApiTags('client-portal-auth')
@Controller('client-portal/auth')
export class ClientAuthController {
  constructor(private clientAuthService: ClientAuthService) {}

  @Public()
  @Post('activate')
  @ApiOperation({ summary: 'Activer son compte portail client' })
  activate(@Body() dto: ActivateClientDto) {
    return this.clientAuthService.activate(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion portail client' })
  login(@Body() dto: ClientLoginDto) {
    return this.clientAuthService.login(dto);
  }
}
