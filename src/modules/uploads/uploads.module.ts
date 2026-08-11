import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
@Module({
  imports: [
    MulterModule.register({
      storage: undefined, // undefined = memoire (memoryStorage), pas de fichier temporaire sur disque
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
