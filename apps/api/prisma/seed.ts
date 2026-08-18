import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as argon2 from 'argon2';
import { ALL_PERMISSIONS, PERMISSION_DESCRIPTIONS } from '../src/common/rbac/permissions.constants';
import { ROLES_CATALOG } from '../src/common/rbac/roles.catalog';

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL manquant.');
  }
  return url;
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(requireDatabaseUrl()) });

async function seedPermissions() {
  for (const code of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: PERMISSION_DESCRIPTIONS[code] },
      create: { code, description: PERMISSION_DESCRIPTIONS[code] },
    });
  }
  console.log(`Permissions : ${ALL_PERMISSIONS.length} synchronisées.`);
}

async function seedRoles() {
  for (const entry of ROLES_CATALOG) {
    // Pas d'upsert ici : @@unique([farmId, name]) avec farmId = null ne
    // protège pas des doublons (NULL n'est jamais égal à NULL pour une
    // contrainte unique SQL) — recherche manuelle explicite à la place.
    let role = await prisma.role.findFirst({
      where: { farmId: null, name: entry.name },
    });

    if (!role) {
      role = await prisma.role.create({
        data: { farmId: null, name: entry.name, isSystem: entry.isSystem },
      });
      console.log(`Rôle créé : ${entry.name}`);
    }

    const permissions = await prisma.permission.findMany({
      where: { code: { in: entry.permissions } },
    });

    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }

    // Retire les permissions qui ne sont plus dans le catalogue attendu pour
    // ce rôle (le seed reste la source de vérité, ré-exécutable sans dérive).
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: { notIn: permissions.map((p) => p.id) },
      },
    });
  }
  console.log(`Rôles : ${ROLES_CATALOG.length} synchronisés.`);
}

async function seedBootstrapFarmAndSuperAdmin() {
  const existingFarm = await prisma.farm.findFirst();
  const farm =
    existingFarm ??
    (await prisma.farm.create({
      data: { name: 'Ferme de démonstration — Samba' },
    }));
  if (!existingFarm) {
    console.log(`Ferme de démonstration créée : ${farm.id}`);
  }

  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@dondy-elevage.cf';
  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (existingUser) {
    console.log(`Compte Super Admin déjà présent (${email}), rien à faire.`);
    return;
  }

  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!password) {
    console.warn(
      "SEED_SUPER_ADMIN_PASSWORD absent : aucun compte Super Admin de bootstrap créé. " +
        'Définir cette variable (dev uniquement) pour amorcer le tout premier compte.',
    );
    return;
  }

  const superAdminRole = await prisma.role.findFirst({
    where: { farmId: null, name: 'Super Admin' },
  });
  if (!superAdminRole) {
    throw new Error('Rôle Super Admin introuvable — lancer seedRoles() avant ce bootstrap.');
  }

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({
    data: {
      farmId: farm.id,
      email,
      name: 'Super Admin (bootstrap)',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true, // Compte d'amorçage : pas de vérification email réelle, comportement documenté.
    },
  });
  await prisma.userRole.create({
    data: { userId: user.id, roleId: superAdminRole.id },
  });
  console.log(`Compte Super Admin de bootstrap créé : ${email}`);
}

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedBootstrapFarmAndSuperAdmin();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
