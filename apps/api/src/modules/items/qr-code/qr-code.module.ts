import { Module } from '@nestjs/common';
import { ItemsModule } from '../items.module';
import { QrCodesModule } from '../../qr-codes/qr-codes.module';
import { ItemQrCodeController } from './qr-code.controller';
import { ItemQrCodeService } from './qr-code.service';

@Module({
  imports: [ItemsModule, QrCodesModule],
  controllers: [ItemQrCodeController],
  providers: [ItemQrCodeService],
})
export class ItemQrCodeModule {}
