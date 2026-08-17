import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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
  { key: 'transactions:cancel', description: 'Annuler une transaction' },
  { key: 'savings:create', description: 'Ouvrir un compte epargne' },
  { key: 'savings:deposit', description: 'Deposer sur un compte epargne' },
  { key: 'savings:withdraw', description: "Retirer d'un compte epargne" },
  { key: 'tontines:create', description: 'Creer un cycle de tontine' },
  {
    key: 'loans:create',
    description: 'Creer et soumettre une demande de pret',
  },
  { key: 'loans:approve', description: 'Approuver ou rejeter un pret' },
];

async function main() {
  const roles = await Promise.all(
    ROLES.map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  const permissions = await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        update: {},
        create: p,
      }),
    ),
  );

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

  const agentRole = roles.find((r) => r.name === 'Agent')!;
  const managerRole = roles.find((r) => r.name === 'Manager')!;
  const caissierRole = roles.find((r) => r.name === 'Caissier')!;
  const comptableRole = roles.find((r) => r.name === 'Comptable')!;

  const clientsCreatePerm = permissions.find(
    (p) => p.key === 'clients:create',
  )!;

  const clientsUpdatePerm = permissions.find(
    (p) => p.key === 'clients:update',
  )!;

  const clientsDeletePerm = permissions.find(
    (p) => p.key === 'clients:delete',
  )!;

  const transactionsCreatePerm = permissions.find(
    (p) => p.key === 'transactions:create',
  )!;

  const transactionsCancelPerm = permissions.find(
    (p) => p.key === 'transactions:cancel',
  )!;

  // Agent et Manager : gestion complete des clients
  await Promise.all(
    [agentRole, managerRole].flatMap((role) =>
      [clientsCreatePerm, clientsUpdatePerm, clientsDeletePerm].map((perm) =>
        prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: perm.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        }),
      ),
    ),
  );

  // Agent, Manager, Caissier : peuvent creer des transactions
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

  // Comptable uniquement : peut annuler une transaction
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: comptableRole.id,
        permissionId: transactionsCancelPerm.id,
      },
    },
    update: {},
    create: {
      roleId: comptableRole.id,
      permissionId: transactionsCancelPerm.id,
    },
  });

  const savingsCreatePerm = permissions.find((p) => p.key === 'savings:create',)!;
  const savingsDepositPerm = permissions.find((p) => p.key === 'savings:deposit',)!;
  const savingsWithdrawPerm = permissions.find((p) => p.key === 'savings:withdraw',)!;

  await Promise.all(
    [agentRole, managerRole, caissierRole].flatMap((role) =>
      [savingsCreatePerm, savingsDepositPerm, savingsWithdrawPerm].map((perm) =>
        prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: perm.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        }),
      ),
    ),
  );

  const tontinesCreatePerm = permissions.find((p) => p.key === 'tontines:create',)!;
  await Promise.all(
    [agentRole, managerRole, caissierRole].map((role) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: tontinesCreatePerm.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: tontinesCreatePerm.id },
      }),
    ),
  );

  //PRET

  const loansCreatePerm = permissions.find((p) => p.key === 'loans:create')!;
  const loansApprovePerm = permissions.find((p) => p.key === 'loans:approve')!;
  // Agent et Caissier : soumettent des demandes, jamais n'approuvent
  await Promise.all(
    [agentRole, caissierRole].map((role) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: loansCreatePerm.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: loansCreatePerm.id },
      }),
    ),
  );

  // Manager : approuve uniquement, jamais ne cree de demande
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: managerRole.id,
        permissionId: loansApprovePerm.id,
      },
    },
    update: {},
    create: { roleId: managerRole.id, permissionId: loansApprovePerm.id },
  });

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
