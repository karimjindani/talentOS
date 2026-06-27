import { PrismaClient, type TenantRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo TalentOS Academy",
      slug: "demo",
      primaryColor: "#2563eb",
      secondaryColor: "#0f172a"
    }
  });

  const program = await prisma.program.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: "ai-native-engineering"
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "AI-Native Software Engineering",
      slug: "ai-native-engineering",
      description: "Applications-first pilot program for TalentOS.",
      status: "PUBLISHED"
    }
  });

  // Platform Super Admin (no tenant membership; identity + credentials live in Keycloak).
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@talentos.local" },
    update: { platformRole: "SUPER_ADMIN" },
    create: {
      email: "superadmin@talentos.local",
      name: "Platform Super Admin",
      platformRole: "SUPER_ADMIN"
    }
  });

  // Demo organization users, one per org-scoped role (mirrors the Keycloak realm import).
  const orgUsers: { email: string; name: string; role: TenantRole }[] = [
    { email: "orgadmin@demo.talentos.local", name: "Demo Org Admin", role: "ORG_ADMIN" },
    { email: "hr@demo.talentos.local", name: "Demo HR", role: "HR" },
    { email: "techlead@demo.talentos.local", name: "Demo Tech Lead", role: "TECH_LEAD" },
    { email: "applicant@demo.talentos.local", name: "Demo Applicant", role: "APPLICANT" }
  ];

  for (const orgUser of orgUsers) {
    const user = await prisma.user.upsert({
      where: { email: orgUser.email },
      update: {},
      create: { email: orgUser.email, name: orgUser.name }
    });

    await prisma.tenantMembership.upsert({
      where: {
        tenantId_userId_role: {
          tenantId: tenant.id,
          userId: user.id,
          role: orgUser.role
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        userId: user.id,
        role: orgUser.role
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorUserId: superAdmin.id,
      action: "seed.initialized",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: { programId: program.id }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
