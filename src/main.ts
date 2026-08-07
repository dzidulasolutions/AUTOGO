import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true }); // bufferLogs: true permet de stocker les logs dans un buffer avant que le logger ne soit initialisé, ce qui est utile pour capturer les logs générés pendant le démarrage de l'application.
  app.useLogger(app.get(Logger));
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
