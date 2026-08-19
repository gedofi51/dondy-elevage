import type { Response } from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PasswordService } from '../../src/modules/auth/password.service';

/**
 * Extrait de auth-rbac.e2e-spec.ts (Phase 1) pour être partagé par les
 * nouveaux fichiers e2e Phase 2, sans dupliquer cette logique trois fois.
 * auth-rbac.e2e-spec.ts lui-même reste inchangé (hors périmètre).
 */
export function body<T>(res: Response): T {
  return res.body as T;
}

/** Insère un utilisateur ACTIVE directement via Prisma (hors flux d'invitation),
 * pratique pour les tests. Le nettoyage (createdUserIds) reste à la charge
 * de l'appelant. */
export async function createActiveUser(
  prisma: PrismaService,
  passwordService: PasswordService,
  farmId: string,
  roleId: string,
  passwordPlain: string,
): Promise<{ id: string; email: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const user = await prisma.user.create({
    data: {
      farmId,
      email,
      name: 'Utilisateur E2E',
      passwordHash: await passwordService.hash(passwordPlain),
      status: 'ACTIVE',
      emailVerified: true,
      userRoles: { create: { roleId } },
    },
  });
  return { id: user.id, email: user.email };
}

export interface LoginResponseBody {
  requiresTwoFactor: boolean;
  accessToken?: string;
  refreshToken?: string;
  challengeToken?: string;
}

export interface ErrorResponseBody {
  message: string;
}
