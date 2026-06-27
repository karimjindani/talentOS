import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@talentos/auth";

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

  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.talentos.local" },
    update: {},
    create: {
      email: "owner@demo.talentos.local",
      name: "Demo Owner",
      passwordHash: await hashPassword("ChangeMe123!")
    }
  });

  const applicant = await prisma.user.upsert({
    where: { email: "applicant@demo.talentos.local" },
    update: {},
    create: {
      email: "applicant@demo.talentos.local",
      name: "Demo Applicant",
      passwordHash: await hashPassword("ChangeMe123!")
    }
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId_role: {
        tenantId: tenant.id,
        userId: owner.id,
        role: "OWNER"
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: owner.id,
      role: "OWNER"
    }
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId_role: {
        tenantId: tenant.id,
        userId: applicant.id,
        role: "APPLICANT"
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: applicant.id,
      role: "APPLICANT"
    }
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorUserId: owner.id,
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
