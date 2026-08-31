import { Module } from '@nestjs/common';
import { BroilerBatchesModule } from '../broiler-batches.module';
import { QrCodesModule } from '../../qr-codes/qr-codes.module';
import { BroilerBatchQrCodeController } from './qr-code.controller';
import { BroilerBatchQrCodeService } from './qr-code.service';

@Module({
  imports: [BroilerBatchesModule, QrCodesModule],
  controllers: [BroilerBatchQrCodeController],
  providers: [BroilerBatchQrCodeService],
})
export class BroilerBatchQrCodeModule {}
