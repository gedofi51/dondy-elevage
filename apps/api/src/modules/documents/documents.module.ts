import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentValidationService } from './document-validation.service';
import { DocumentStorageService } from './document-storage.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Buffer en mémoire (pas d'écriture disque tant que le contenu n'est
        // pas validé) — fichiers de documents (factures, photos, certificats)
        // suffisamment petits pour ça, avec une limite dure imposée ici.
        storage: memoryStorage(),
        limits: {
          fileSize: config.get<number>('DOCUMENTS_MAX_UPLOAD_SIZE_MB', 10) * 1024 * 1024,
          files: 1,
        },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentValidationService, DocumentStorageService],
})
export class DocumentsModule {}
