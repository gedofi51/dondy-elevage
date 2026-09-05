import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateLayerBatchDto {
  @IsDateString()
  entryDate!: string;

  /** Souche, texte libre — comme CreateBroilerBatchDto.breed. */
  @IsOptional()
  @IsString()
  strain?: string;

  @IsInt()
  @Min(1)
  initialQuantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ageAtEntryWeeks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ageAtEntryDays?: number;

  @IsUUID('4')
  buildingId!: string;

  /** Option A (Bâtiments/Blocs) — facultatif, doit appartenir à
   * buildingId (vérifié en service). */
  @IsOptional()
  @IsUUID('4')
  blockId?: string;

  @IsUUID('4')
  primaryManagerId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  observations?: string;
}
