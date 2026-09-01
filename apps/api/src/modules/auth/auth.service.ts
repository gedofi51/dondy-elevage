import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { generateOpaqueToken, hashOpaqueToken } from '../../common/security/opaque-token.util';
import type { ActivateAccountDto } from './dto/activate-account.dto';
import type { LoginDto } from './dto/login.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { VerifyTwoFactorDto } from './dto/two-factor.dto';

const EMAIL_VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

const userWithRolesInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userWithRolesInclude }>;

export type LoginResult =
  | { requiresTwoFactor: true; challengeToken: string }
  | { requiresTwoFactor: false; accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    private readonly auditLogService: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  /** Déclenché par UsersService à la création d'un compte (admin only). */
  async issueInvitation(userId: string, email: string, name: string): Promise<void> {
    const token = generateOpaqueToken();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationTokenHash: hashOpaqueToken(token),
        emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });
    const link = `${this.config.get<string>('APP_URL')}/activer-compte?token=${token}`;
    await this.mailService.envoyerInvitation(email, name, link);
  }

  async activateAccount(dto: ActivateAccountDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationTokenHash: hashOpaqueToken(dto.token) },
    });

    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException("Lien d'activation invalide ou expiré.");
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });
  }

  async login(dto: LoginDto, ipAddress: string | null): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: userWithRolesInclude,
    });

    // Compte inconnu OU jamais activé (passwordHash null) : même message
    // générique, anti-énumération — et pas d'AuditLog pour un compte
    // inexistant (farmId inconnu, voir docs/architecture, section blocages).
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }

    const passwordOk = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      await this.auditLogService.record({
        farmId: user.farmId,
        userId: user.id,
        entityType: 'auth',
        entityId: user.id,
        action: 'LOGIN_FAILED',
        ipAddress,
      });
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte désactivé ou suspendu.');
    }

    if (user.twoFactorEnabled) {
      return {
        requiresTwoFactor: true,
        challengeToken: this.tokenService.signTwoFactorChallenge(user.id),
      };
    }

    return this.completeLogin(user, ipAddress);
  }

  async verifyTwoFactor(dto: VerifyTwoFactorDto, ipAddress: string | null): Promise<LoginResult> {
    const challenge = this.tokenService.verifyTwoFactorChallenge(dto.challengeToken);
    const user = await this.prisma.user.findUnique({
      where: { id: challenge.sub },
      include: userWithRolesInclude,
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Challenge 2FA invalide.');
    }

    const valid = authenticator.check(dto.code, user.twoFactorSecret);
    if (!valid) {
      await this.auditLogService.record({
        farmId: user.farmId,
        userId: user.id,
        entityType: 'auth',
        entityId: user.id,
        action: 'LOGIN_2FA_FAILED',
        ipAddress,
      });
      throw new UnauthorizedException('Code 2FA invalide.');
    }

    return this.completeLogin(user, ipAddress);
  }

  async refresh(plainRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { userId, refreshToken } = await this.tokenService.rotateRefreshToken(plainRefreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolesInclude,
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte introuvable ou inactif.');
    }

    const { roles, permissions } = this.resolveRolesAndPermissions(user);
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      farmId: user.farmId,
      roles,
      permissions,
    });

    return { accessToken, refreshToken: refreshToken.token };
  }

  async logout(plainRefreshToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(plainRefreshToken);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (!user) {
      return; // anti-énumération : le contrôleur renvoie toujours la même réponse
    }

    const token = generateOpaqueToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashOpaqueToken(token),
        passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const link = `${this.config.get<string>('APP_URL')}/reinitialiser-mot-de-passe?token=${token}`;
    await this.mailService.envoyerReinitialisationMotDePasse(user.email, link);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: hashOpaqueToken(dto.token) },
    });

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Lien de réinitialisation invalide ou expiré.');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
    });

    // Un changement de mot de passe doit invalider tout accès existant.
    await this.tokenService.revokeAllUserRefreshTokens(user.id);
  }

  /**
   * OAuth Google/Microsoft : jamais de création de compte à la volée (la
   * création reste admin-only, voir UsersService). Un compte existant et
   * ACTIVE se lie automatiquement sur correspondance d'email (l'email est
   * déjà vérifié par le fournisseur OAuth) ; un compte INVITED se lie ET
   * s'active dans le même mouvement (l'OAuth vaut preuve de possession de
   * l'email, équivalent au lien d'activation classique). Aucun compte
   * trouvé → rejet explicite, pas de compte fantôme créé.
   */
  async handleOAuthLogin(
    provider: 'GOOGLE' | 'MICROSOFT',
    providerAccountId: string,
    email: string,
    ipAddress: string | null,
  ): Promise<LoginResult> {
    const existingLink = await this.prisma.oauthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: { include: userWithRolesInclude } },
    });

    if (existingLink) {
      if (existingLink.user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Compte désactivé ou suspendu.');
      }
      return this.completeLogin(existingLink.user, ipAddress);
    }

    const user = await this.prisma.user.findFirst({
      where: { email },
      include: userWithRolesInclude,
    });

    if (!user) {
      throw new UnauthorizedException(
        'Aucun compte DONDY ELEVAGE ne correspond à cet email — contactez votre administrateur.',
      );
    }

    if (user.status !== 'ACTIVE' && user.status !== 'INVITED') {
      throw new UnauthorizedException('Compte désactivé ou suspendu.');
    }

    await this.prisma.oauthAccount.create({
      data: { userId: user.id, provider, providerAccountId },
    });

    const activatedUser =
      user.status === 'INVITED'
        ? await this.prisma.user.update({
            where: { id: user.id },
            data: {
              status: 'ACTIVE',
              emailVerified: true,
              emailVerificationTokenHash: null,
              emailVerificationExpiresAt: null,
            },
            include: userWithRolesInclude,
          })
        : user;

    return this.completeLogin(activatedUser, ipAddress);
  }

  async enableTwoFactor(userId: string): Promise<{ otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

    const otpauthUrl = authenticator.keyuri(user.email, 'DONDY ELEVAGE', secret);
    const qrCodeDataUrl = await toDataURL(otpauthUrl);
    return { otpauthUrl, qrCodeDataUrl };
  }

  async confirmTwoFactor(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) {
      throw new BadRequestException("Activation 2FA non initiée (POST /auth/2fa/activer d'abord).");
    }
    if (!authenticator.check(code, user.twoFactorSecret)) {
      throw new BadRequestException('Code invalide.');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  }

  async disableTwoFactor(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA déjà désactivée.');
    }
    if (!authenticator.check(code, user.twoFactorSecret)) {
      throw new BadRequestException('Code invalide.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
  }

  private async completeLogin(user: UserWithRoles, ipAddress: string | null): Promise<LoginResult> {
    const { roles, permissions } = this.resolveRolesAndPermissions(user);
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      farmId: user.farmId,
      roles,
      permissions,
    });
    const refreshToken = await this.tokenService.issueRefreshToken(user.id);

    await this.auditLogService.record({
      farmId: user.farmId,
      userId: user.id,
      entityType: 'auth',
      entityId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress,
    });

    return { requiresTwoFactor: false, accessToken, refreshToken: refreshToken.token };
  }

  private resolveRolesAndPermissions(user: UserWithRoles): {
    roles: string[];
    permissions: string[];
  } {
    const roles = user.userRoles.map((userRole) => userRole.role.name);
    const permissions = new Set<string>();
    for (const userRole of user.userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.code);
      }
    }
    return { roles, permissions: [...permissions] };
  }
}
