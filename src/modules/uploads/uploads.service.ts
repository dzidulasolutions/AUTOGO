import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { configureCloudinary } from './cloudinary.config';
import { UploadApiResponse } from 'cloudinary';

@Injectable()
export class UploadsService {
  private cloudinary = configureCloudinary();
  private readonly logger = new Logger(UploadsService.name);

  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    return new Promise<string>((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        { folder: 'autogo' },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            this.logger.error('Erreur Cloudinary', error);
            return reject(new BadRequestException("Echec de l'upload"));
          }
          resolve(result.secure_url);
        },
      );
      uploadStream.end(file.buffer);
    });
  }
}
