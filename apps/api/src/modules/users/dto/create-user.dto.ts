import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(191)
  email!: string;

  @IsString()
  @MaxLength(191)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds!: string[];

  /** Réservé aux acteurs avec `platform.manage` (Super Admin) — sinon ignoré, la ferme de l'acteur est utilisée. */
  @IsOptional()
  @IsUUID('4')
  farmId?: string;
}
