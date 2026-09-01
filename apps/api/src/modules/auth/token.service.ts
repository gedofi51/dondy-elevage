import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccessTokenPayload, TwoFactorChallengePayload } from './jwt-payload.interface';
import { generateOpaqueToken, hashOpaqueToken } from '../../common/security/opaque-token.util';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // aligné sur JWT_REFRESH_EXPIRES_IN=30d par défaut

export interface IssuedRefreshToken {
  token: string; // valeur en clair, retournée au client une seule fois
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
    const fullPayload: AccessTokenPayload = { ...payload, type: 'access' };
    return this.jwt.sign(fullPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      // Cast nécessaire : ConfigService.get() renvoie un `string` générique,
      // pendant que jsonwebtoken attend le type littéral `StringValue` (du
      // paquet `ms`) — la valeur réelle ("15m" par défaut) est bien valide.
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as StringValue,
    });
  }

  signTwoFactorChallenge(userId: string): string {
    const payload: TwoFactorChallengePayload = { sub: userId, type: 'two_factor_challenge' };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('TWO_FACTOR_CHALLENGE_SECRET'),
      expiresIn: '5m',
    });
  }

  verifyTwoFactorChallenge(token: string): TwoFactorChallengePayload {
    try {
      return this.jwt.verify<TwoFactorChallengePayload>(token, {
        secret: this.config.getOrThrow<string>('TWO_FACTOR_CHALLENGE_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Challenge 2FA invalide ou expiré.');
    }
  }

  async issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashOpaqueToken(token), expiresAt },
    });
    return { token, expiresAt };
  }

  /**
   * Rotation : le refresh token présenté est révoqué et remplacé par un
   * nouveau. Une réutilisation d'un token déjà révoqué (donc déjà remplacé)
   * indique un vol probable — toute la famille de refresh tokens de
   * l'utilisateur est alors révoquée immédiatement.
   */
  async rotateRefreshToken(
    plainToken: string,
  ): Promise<{ userId: string; refreshToken: IssuedRefreshToken }> {
    const tokenHash = hashOpaqueToken(plainToken);
    const existing = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });

    if (!existing) {
      throw new UnauthorizedException('Refresh token invalide.');
    }

    if (existing.revokedAt) {
      // Token déjà utilisé (rotation précédente) ou révoqué explicitement :
      // réutilisation détectée → révocation de toute la famille par sécurité.
      await this.revokeAllUserRefreshTokens(existing.userId);
      throw new UnauthorizedException('Refresh token déjà utilisé — sessions révoquées.');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expiré.');
    }

    const newRefreshToken = await this.issueRefreshToken(existing.userId);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenHash: hashOpaqueToken(newRefreshToken.token),
      },
    });

    return { userId: existing.userId, refreshToken: newRefreshToken };
  }

  async revokeRefreshToken(plainToken: string): Promise<void> {
    const tokenHash = hashOpaqueToken(plainToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
