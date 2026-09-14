import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { env } from '../src/config/env.js';
import { seedPermissions, seedRoles } from './seed/access.js';

/**
 * Reference-data seed.
 *
 * Every write is an upsert on a natural unique key, so this is safe to run on
 * every deploy — and it *must* be run on every deploy: a release that adds a
 * module adds permission rows, and without them the new screens load and then
 * 403, which reads like a broken build rather than missing data.
 *
 * There is no self-signup endpoint in this pattern. A new organisation and its
 * first administrator are created by running this script.
 */

const prisma = new PrismaClient();

const seedOrganization = async (): Promise<{ organizationId: string; branchId: string }> => {
  const organization = await prisma.organization.upsert({
    where: { code: env.SEED_ORG_CODE },
    create: {
      code: env.SEED_ORG_CODE,
      name: env.SEED_COMPANY_NAME,
      legalName: env.SEED_COMPANY_NAME,
      email: env.SEED_ADMIN_EMAIL,
    },
    // Deliberately narrow: re-seeding must not overwrite details an
    // administrator has since edited in the app.
    update: {},
    select: { id: true },
  });

  const branch = await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'HO' } },
    create: {
      organizationId: organization.id,
      code: 'HO',
      name: 'Head Office',
      isHeadOffice: true,
    },
    update: {},
    select: { id: true },
  });

  return { organizationId: organization.id, branchId: branch.id };
};

const seedAdmin = async (
  organizationId: string,
  branchId: string,
  superAdminRoleId: string,
): Promise<void> => {
  const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, env.BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL },
    create: {
      organizationId,
      branchId,
      fullName: 'System Administrator',
      email: env.SEED_ADMIN_EMAIL,
      employeeCode: 'ADMIN',
      passwordHash,
      status: 'ACTIVE',
      isSuperAdmin: true,
      // The seeded password is in a file on disk and in shell history — it is a
      // bootstrap credential, not a real one.
      mustChangePassword: true,
    },
    // Never reset the password of an account that already exists: a re-seed on
    // a live deployment would otherwise hand the .env password back to anyone
    // who can read the repo.
    update: { isSuperAdmin: true, status: 'ACTIVE', isActive: true, deletedAt: null },
    select: { id: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdminRoleId } },
    create: { userId: user.id, roleId: superAdminRoleId },
    update: {},
  });
};

const main = async (): Promise<void> => {
  console.log('Seeding reference data…');

  const permissionIds = await seedPermissions(prisma);
  console.log(`  permissions      ${permissionIds.size}`);

  const { organizationId, branchId } = await seedOrganization();
  console.log(`  organization     ${env.SEED_ORG_CODE} (${organizationId})`);

  const roleIds = await seedRoles(prisma, organizationId, permissionIds);
  console.log(`  roles            ${[...roleIds.keys()].join(', ')}`);

  const superAdminRoleId = roleIds.get('super_admin');
  if (!superAdminRoleId) throw new Error('super_admin role was not seeded');

  await seedAdmin(organizationId, branchId, superAdminRoleId);
  console.log(`  admin            ${env.SEED_ADMIN_EMAIL}`);

  console.log('Seed complete.');
};

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
