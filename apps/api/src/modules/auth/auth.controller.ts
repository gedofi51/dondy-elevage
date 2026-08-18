import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GoogleOAuthGuard } from '../../common/guards/google-oauth.guard';
import { MicrosoftOAuthGuard } from '../../common/guards/microsoft-oauth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from './jwt-payload.interface';
import { AuthService, type LoginResult } from './auth.service';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfirmTwoFactorDto, DisableTwoFactorDto, VerifyTwoFactorDto } from './dto/two-factor.dto';

function extractIp(req: Request): string | null {
  return req.ip ?? null;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('activer-compte')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.OK)
  async activerCompte(@Body() dto: ActivateAccountDto): Promise<{ message: string }> {
    await this.authService.activateAccount(dto);
    return { message: 'Compte activé. Vous pouvez vous connecter.' };
  }

  @Post('connexion')
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async connexion(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResult> {
    return this.authService.login(dto, extractIp(req));
  }

  @Post('2fa/verifier')
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async verifierDeuxFacteurs(
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: Request,
  ): Promise<LoginResult> {
    return this.authService.verifyTwoFactor(dto, extractIp(req));
  }

  @Post('rafraichir')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async rafraichir(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('deconnexion')
  @HttpCode(HttpStatus.OK)
  async deconnexion(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Déconnecté.' };
  }

  @Post('mot-de-passe-oublie')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.OK)
  async motDePasseOublie(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto);
    // Réponse identique que l'email existe ou non — anti-énumération.
    return { message: 'Si ce compte existe, un email a été envoyé.' };
  }

  @Post('reinitialiser-mot-de-passe')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.OK)
  async reinitialiserMotDePasse(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return { message: 'Mot de passe mis à jour. Toutes les sessions ont été fermées.' };
  }

  @Post('2fa/activer')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async activerDeuxFacteurs(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<{ otpauthUrl: string; qrCodeDataUrl: string }> {
    return this.authService.enableTwoFactor(user.sub);
  }

  @Post('2fa/confirmer')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async confirmerDeuxFacteurs(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: ConfirmTwoFactorDto,
  ): Promise<{ message: string }> {
    await this.authService.confirmTwoFactor(user.sub, dto.code);
    return { message: '2FA activée.' };
  }

  @Post('2fa/desactiver')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async desactiverDeuxFacteurs(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: DisableTwoFactorDto,
  ): Promise<{ message: string }> {
    await this.authService.disableTwoFactor(user.sub, dto.code);
    return { message: '2FA désactivée.' };
  }

  @Get('oauth/google')
  @UseGuards(GoogleOAuthGuard)
  oauthGoogle(): void {
    // Redirection vers Google gérée entièrement par la stratégie passport.
  }

  @Get('oauth/google/callback')
  @UseGuards(GoogleOAuthGuard)
  oauthGoogleCallback(@Req() req: Request, @Res() res: Response): void {
    this.redirectWithTokens(req, res);
  }

  @Get('oauth/microsoft')
  @UseGuards(MicrosoftOAuthGuard)
  oauthMicrosoft(): void {
    // Redirection vers Microsoft gérée entièrement par la stratégie passport.
  }

  @Get('oauth/microsoft/callback')
  @UseGuards(MicrosoftOAuthGuard)
  oauthMicrosoftCallback(@Req() req: Request, @Res() res: Response): void {
    this.redirectWithTokens(req, res);
  }

  /**
   * Handoff vers le front par redirection (pas de session serveur/cookie) :
   * la page /oauth/callback (à construire côté apps/web) récupère les tokens
   * dans les paramètres d'URL puis nettoie la barre d'adresse. Hors périmètre
   * backend de la Phase 1.
   */
  private redirectWithTokens(req: Request, res: Response): void {
    const result = req.user as LoginResult;
    const appUrl = this.config.get<string>('APP_URL', '');

    if (!result.requiresTwoFactor) {
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      res.redirect(`${appUrl}/oauth/callback?${params.toString()}`);
      return;
    }

    res.redirect(
      `${appUrl}/oauth/callback?requiresTwoFactor=1&challengeToken=${result.challengeToken}`,
    );
  }
}
