import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PasswordService } from '../../src/modules/auth/password.service';

/**
 * Garantit que `app.close()` s'exécute même si `cleanup` échoue (ex. une
 * contrainte FK oubliée en ajoutant un test plus tard sans mettre à jour
 * l'ordre de suppression) — sinon l'application Nest de test reste vivante
 * indéfiniment (connexion Prisma + crons ScheduleModule ouverts) et bloque
 * Jest en silence, sans le moindre message d'erreur si la sortie standard
 * est pipée (`| tail`). Bug réel rencontré deux fois indépendamment :
 * Phase 8 (treasury.e2e-spec.ts, incident CI) et Phase 16
 * (assets.e2e-spec.ts, blocage de plusieurs heures) — voir
 * DETTE_TECHNIQUE.md. Tout nouveau fichier e2e DOIT utiliser ce helper
 * dans son `afterAll` plutôt que d'appeler `app.close()` en dernière
 * ligne sans protection.
 */
export async function closeAppSafely(
  app: INestApplication,
  cleanup: () => Promise<void>,
): Promise<void> {
  try {
    await cleanup();
  } finally {
    await app.close();
  }
}

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
