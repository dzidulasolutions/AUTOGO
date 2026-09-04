import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientAuthController } from './auth/auth.controller';
import { ClientAuthService } from './auth/auth.service';
import { PortalController } from './portal.controller';
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ClientAuthController, PortalController],
  providers: [ClientAuthService],
})
export class ClientPortalModule {}
