import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { NetworkOperationalStatus } from '@prisma/client';

export class CreateNetworkStatusReadingDto {
  @IsDateString()
  date!: string;

  @IsEnum(NetworkOperationalStatus)
  operationalStatus!: NetworkOperationalStatus;

  @IsOptional()
  @IsString()
  observations?: string;
}
