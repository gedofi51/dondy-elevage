import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NetworkOperationalStatus } from '@prisma/client';

export class UpdateNetworkStatusReadingDto {
  @IsOptional()
  @IsEnum(NetworkOperationalStatus)
  operationalStatus?: NetworkOperationalStatus;

  @IsOptional()
  @IsString()
  observations?: string;
}
