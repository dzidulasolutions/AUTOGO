import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Roles systeme
const ROLES = [
  'SuperAdmin',
  'Admin',
  'Manager',
  'Agent',
  'Caissier',
  'Comptable',
  'Client',
];

const PERMISSIONS = [
  { key: 'users:create', description: 'Creer un utilisateur' },
  { key: 'users:read', description: 'Consulter les utilisateurs' },
  { key: 'users:update', description: 'Modifier un utilisateur' },
  { key: 'users:delete', description: 'Supprimer (desactiver) un utilisateur' },
  { key: 'roles:manage', description: 'Gerer les roles et permissions' },
  { key: 'branches:create', description: 'Creer une agence' },
  { key: 'branches:update', description: 'Modifier une agence' },
  { key: 'branches:delete', description: 'Desactiver une agence' },
  { key: 'clients:create', description: 'Creer un client' },
  { key: 'clients:update', description: 'Modifier un client' },
  { key: 'clients:delete', description: 'Desactiver un client' },
  { key: 'transactions:create', description: 'Creer une transaction' },
];

async function main() {
  // 1. Creer les roles (
  // upsert = cree si absent, ignore si deja present, evite les doublons si on relance le seed)
  const roles = await Promise.all(
    ROLES.map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  // 2. Creer les permissions
  const permissions = await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        update: {},
        create: p,
      }),
    ),
  );

  // 3. Le role SuperAdmin recoit TOUTES les permissions existantes
  const superAdminRole = roles.find((r) => r.name === 'SuperAdmin')!;
  await Promise.all(
    permissions.map((perm) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: perm.id },
      }),
    ),
  );

  // 4. Creer le premier compte Super Admin
  const hashedPassword = await argon2.hash(process.env.SUPER_ADMIN_PASSWORD!);

  await prisma.user.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL! },
    update: {},
    create: {
      email: process.env.SUPER_ADMIN_EMAIL!,
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      roleId: superAdminRole.id,
      emailVerified: true,
    },
  });

  // Le role Agent et Manager peuvent creer des clients
  const agentRole = roles.find((r) => r.name === 'Agent')!;
  const caissierRole = roles.find((r) => r.name === 'Caissier')!;
  const managerRole = roles.find((r) => r.name === 'Manager')!;
  const transactionsCreatePerm = permissions.find((p) => p.key === 'transactions:create')!;

  const clientsCreatePerm = permissions.find(
    (p) => p.key === 'clients:create',
  )!;

  await Promise.all(
    [agentRole, managerRole].map((role) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: clientsCreatePerm.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: clientsCreatePerm.id },
      }),
    ),
  );

  const clientsUpdatePerm = permissions.find(
    (p) => p.key === 'clients:update',
  )!;
  const clientsDeletePerm = permissions.find(
    (p) => p.key === 'clients:delete',
  )!;

  await Promise.all(
    [agentRole, managerRole, caissierRole].map((role) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: transactionsCreatePerm.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: transactionsCreatePerm.id },
      }),
    ),
  );

  console.log('Seed termine avec succes');
}

main()
  .catch((e) => {
    console.error('Erreur pendant le seed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
