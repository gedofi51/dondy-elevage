import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  /**
   * Texte libre, pas d'allowlist figée : de nouveaux types d'entités
   * apparaîtront à chaque phase future (bâtiments, bandes, mortalité...) —
   * une liste fermée ici obligerait à modifier ce DTO à chaque phase.
   */
  @IsString()
  @MaxLength(64)
  entityType!: string;

  @IsString()
  @MaxLength(191)
  entityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;
}
