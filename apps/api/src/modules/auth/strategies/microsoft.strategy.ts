import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import type { VerifyCallback } from 'passport-oauth2';
import { AuthService } from '../auth.service';
import type { LoginResult } from '../auth.service';

/**
 * `passport-microsoft` ne fournit pas de type de profil précis (`any` côté
 * @types/passport-oauth2) — forme réellement renvoyée par la librairie à
 * l'exécution, alignée sur le même format que passport-google-oauth20.
 */
interface MicrosoftProfile {
  id: string;
  emails?: Array<{ value: string }>;
}

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    // Même contrainte que GoogleStrategy : clientID non vide obligatoire à
    // la construction, voir commentaire équivalent dans google.strategy.ts.
    super({
      clientID: config.get<string>('OAUTH_MICROSOFT_CLIENT_ID') || 'not-configured',
      clientSecret: config.get<string>('OAUTH_MICROSOFT_CLIENT_SECRET') || 'not-configured',
      callbackURL: config.get<string>('OAUTH_MICROSOFT_CALLBACK_URL', ''),
      scope: ['user.read'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: MicrosoftProfile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new UnauthorizedException('Compte Microsoft sans email accessible.'), false);
      return;
    }

    try {
      const result: LoginResult = await this.authService.handleOAuthLogin(
        'MICROSOFT',
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
