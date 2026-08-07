import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true }); // bufferLogs: true permet de stocker les logs dans un buffer avant que le logger ne soit initialisé, ce qui est utile pour capturer les logs générés pendant le démarrage de l'application.
  app.useLogger(app.get(Logger));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
