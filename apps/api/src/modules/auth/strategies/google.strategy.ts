import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import type { LoginResult } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    // `passport-oauth2` lève une TypeError si clientID est vide/absent —
    // valeur de repli non vide pour que l'API démarre normalement tant que
    // l'app OAuth réelle n'est pas encore enregistrée (route existante mais
    // non fonctionnelle jusqu'à configuration des vraies credentials).
    super({
      clientID: config.get<string>('OAUTH_GOOGLE_CLIENT_ID') || 'not-configured',
      clientSecret: config.get<string>('OAUTH_GOOGLE_CLIENT_SECRET') || 'not-configured',
      callbackURL: config.get<string>('OAUTH_GOOGLE_CALLBACK_URL', ''),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new UnauthorizedException('Compte Google sans email accessible.'), false);
      return;
    }

    try {
      const result: LoginResult = await this.authService.handleOAuthLogin(
        'GOOGLE',
        profile.id,
        email,
        null,
      );
      done(null, result);
    } catch (error) {
      done(error, false);
    }
  }
}
