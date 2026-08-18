import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();
    service = module.get(PasswordService);
  });

  it('hashes a password and verifies it correctly', async () => {
    const hash = await service.hash('un-mot-de-passe-solide');
    expect(hash).not.toBe('un-mot-de-passe-solide');
    expect(hash.startsWith('$argon2')).toBe(true);
    await expect(service.verify(hash, 'un-mot-de-passe-solide')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('un-mot-de-passe-solide');
    await expect(service.verify(hash, 'un-autre-mot-de-passe')).resolves.toBe(false);
  });

  it('produces a different hash each time (salt aléatoire)', async () => {
    const hash1 = await service.hash('meme-mot-de-passe');
    const hash2 = await service.hash('meme-mot-de-passe');
    expect(hash1).not.toBe(hash2);
  });
});
