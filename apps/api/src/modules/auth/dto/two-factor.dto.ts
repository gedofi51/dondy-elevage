import { IsString, Length } from 'class-validator';

export class ConfirmTwoFactorDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class DisableTwoFactorDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class VerifyTwoFactorDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
