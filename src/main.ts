import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { PrismaService } from './database/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true }); // bufferLogs: true permet de stocker les logs dans un buffer avant que le logger ne soit initialisé, ce qui est utile pour capturer les logs générés pendant le démarrage de l'application.
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // supprime automatiquement les champs non declares dans le DTO
      forbidNonWhitelisted: true, // rejette la requete si un champ inconnu est envoye, plutot que de l'ignorer silencieusement
      transform: true, // convertit automatiquement les types (ex: string "123" -> number 123)
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // authorisation globale pour toutes les routes, sauf celles qui sont explicitement publiques (decorateur @Public)
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // permissions guard pour toutes les routes, sauf celles qui sont explicitement publiques (decorateur @Public)
  const prismaService = app.get(PrismaService);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new PermissionsGuard(reflector, prismaService),
  );

  const config = new DocumentBuilder()
    .setTitle('AuTogo API')
    .setDescription('API backend pour la plateforme de microfinance AuTogo')
    .setVersion('0.1')
    .addBearerAuth() // pour l'authentification JWT qu'on ajoutera plus tard
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error) => {
  console.error("Erreur au demarrage de l'application", error);
  process.exit(1);
});
