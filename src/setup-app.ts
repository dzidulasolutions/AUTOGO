import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { PrismaService } from './database/prisma.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import helmet from 'helmet';

export function setupApp(app: INestApplication) {
  app.use(helmet());
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? (process.env.ALLOWED_ORIGINS?.split(',') ?? []) // a remplacer par le vrai domaine du futur frontend
        : true, // en dev, autorise tout (Swagger, tests locaux)
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(
    new TransformInterceptor(),
    app.get(AuditInterceptor), // recupere l'instance via le conteneur d'injection, car il depend de PrismaService et Reflector
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const reflector = app.get(Reflector);
  const prismaService = app.get(PrismaService);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new PermissionsGuard(reflector, prismaService),
  );
}
