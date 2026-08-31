import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets.module';
import { QrCodesModule } from '../../qr-codes/qr-codes.module';
import { AssetQrCodeController } from './qr-code.controller';
import { AssetQrCodeService } from './qr-code.service';

@Module({
  imports: [AssetsModule, QrCodesModule],
  controllers: [AssetQrCodeController],
  providers: [AssetQrCodeService],
})
export class AssetQrCodeModule {}
