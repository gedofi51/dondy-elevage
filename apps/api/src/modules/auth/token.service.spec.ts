import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.TWO_FACTOR_CHALLENGE_SECRET = 'test-2fa-secret';

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), JwtModule.register({})],
      providers: [TokenService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get(TokenService);
  });

  it('signs an access token embedding roles and permissions', () => {
    const token = service.signAccessToken({
      sub: 'user-1',
      farmId: 'farm-1',
      roles: ['Employé'],
      permissions: ['farms.read'],
    });

    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    const payloadPart = parts[1];
    if (!payloadPart) {
      throw new Error('Payload JWT manquant.');
    }
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    expect(payload.sub).toBe('user-1');
    expect(payload.farmId).toBe('farm-1');
    expect(payload.permissions).toEqual(['farms.read']);
    expect(payload.type).toBe('access');
  });

  it('signs and verifies a 2FA challenge token', () => {
    const challenge = service.signTwoFactorChallenge('user-1');
    const verified = service.verifyTwoFactorChallenge(challenge);
    expect(verified.sub).toBe('user-1');
    expect(verified.type).toBe('two_factor_challenge');
  });

  it('rejects a 2FA challenge token signed with a different secret', async () => {
    const challenge = service.signTwoFactorChallenge('user-1');

    // ConfigService met en cache les valeurs à la construction du module :
    // muter process.env après coup n'aurait aucun effet sur `service`, d'où
    // une seconde instance construite avec un secret différent dès le départ.
    process.env.TWO_FACTOR_CHALLENGE_SECRET = 'a-different-secret';
    const otherModule: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), JwtModule.register({})],
      providers: [TokenService, { provide: PrismaService, useValue: {} }],
    }).compile();
    const otherService = otherModule.get(TokenService);

    expect(() => otherService.verifyTwoFactorChallenge(challenge)).toThrow(UnauthorizedException);
  });
});
