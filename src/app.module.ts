import { DatabaseModule } from './database/database.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './config/env.validation';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './modules/health/health.module';
@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
