import { IsOptional, IsString, MaxLength } from 'class-validator';

/** buildingId volontairement absent — un bloc ne change jamais de bâtiment
 * une fois créé (évite d'invalider silencieusement le blockId déjà choisi
 * sur des bandes existantes). CRUD simple nom/code, conformément au
 * périmètre de ce lot (voir DETTE_TECHNIQUE.md). */
export class UpdateBlockDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;
}
