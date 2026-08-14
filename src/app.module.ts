import { DatabaseModule } from './database/database.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './config/env.validation';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './common/guards/throttler.guard';

import { APP_GUARD } from '@nestjs/core';
import { BranchesModule } from './modules/branches/branches.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { ClientsModule } from './modules/clients/clients.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { SavingsModule } from './modules/savings/savings.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // fenetre de 60 secondes
        limit: 20, // 20 requetes par minute par defaut, pour toute l'API
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true, // pas besoin de reimporter ConfigModule dans chaque module — tu pourras injecter ConfigService n'importe ou dans l'app
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // affiche toutes les erreurs, pas juste la premiere
      },
    }),
    // Pino bibliothèque de logging pour Node.js. En gros, elle sert à afficher et enregistrer ce qui se passe dans ton application.
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
      },
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    BranchesModule,
    ClientsModule,
    UploadsModule,
    TransactionsModule,
    SavingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AuditInterceptor,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
