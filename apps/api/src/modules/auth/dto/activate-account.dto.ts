import { IsString, MinLength } from 'class-validator';

export class ActivateAccountDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères.' })
  password!: string;
}
