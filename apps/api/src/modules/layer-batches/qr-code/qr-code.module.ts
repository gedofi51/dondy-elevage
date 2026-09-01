import { Module } from '@nestjs/common';
import { LayerBatchesModule } from '../layer-batches.module';
import { QrCodesModule } from '../../qr-codes/qr-codes.module';
import { LayerBatchQrCodeController } from './qr-code.controller';
import { LayerBatchQrCodeService } from './qr-code.service';

@Module({
  imports: [LayerBatchesModule, QrCodesModule],
  controllers: [LayerBatchQrCodeController],
  providers: [LayerBatchQrCodeService],
})
export class LayerBatchQrCodeModule {}
