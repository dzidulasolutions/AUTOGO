import { DatabaseModule } from './database/database.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './config/env.validation';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // pas besoin de reimporter ConfigModule dans chaque module — tu pourras injecter ConfigService n'importe ou dans l'app
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // affiche toutes les erreurs, pas juste la premiere
      },
    }),
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
