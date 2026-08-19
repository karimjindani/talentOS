#!/usr/bin/env tsx
import { prisma, createJournalEntry } from '@talentos/db';

async function main() {
  // Find an accepted user seed from demo: accepted@demo.talentos.local
  const user = await prisma.user.findUnique({ where: { email: 'accepted@demo.talentos.local' } });
  if (!user) {
    console.error('accepted@demo.talentos.local not found — ensure demo seed present');
    process.exit(1);
  }

  // Ensure graduate profile exists and is acknowledged/published.
  // createOrUpdateGraduateProfile enforces graduation rules; use direct upsert for test evidence.
  const slug = `seed-${user.id.slice(0, 8)}`;
  await prisma.graduateProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      slug,
      bio: 'Auto-seeded public profile for E2E evidence',
      skills: ['JavaScript', 'TypeScript'],
      country: 'Testland',
      publicProfileEnabled: true,
      consentStatus: 'ACKNOWLEDGED',
      consentDate: new Date(),
      graduationDate: new Date(),
      overallRating: 4.0,
    },
    update: {
      bio: 'Auto-seeded public profile for E2E evidence',
      skills: ['JavaScript', 'TypeScript'],
      country: 'Testland',
      publicProfileEnabled: true,
      consentStatus: 'ACKNOWLEDGED',
      consentDate: new Date(),
      overallRating: 4.0,
    }
  });

  // Create a journal entry for the accepted user if none exists (direct insert with minimal valid fields)
  const existing = await prisma.engineeringJournalEntry.findFirst({ where: { applicantId: user.id } });
  if (!existing) {
    const mission = await prisma.mission.findFirst({ where: { status: 'PUBLISHED' } });
    const tenantId = mission?.tenantId ?? user.memberships?.[0]?.tenantId ?? 'demo';
    const programId = mission?.programId ?? 'seed-program';
    const weekNumber = mission?.weekNumber ?? 1;

    await prisma.engineeringJournalEntry.create({
      data: {
        tenantId,
        applicantId: user.id,
        programId,
        missionId: mission?.id ?? `seed-mission-${weekNumber}`,
        missionAssignmentId: null,
        weekNumber,
        entryDate: new Date(),
        language: 'English',
        workedOn: 'Auto-seeded work',
        challenge: 'N/A',
        solution: 'N/A',
        learned: 'N/A',
        aiUsage: 'None',
        confidenceRating: 4,
        timeSpentHours: 1.0,
        evidenceLinks: []
      }
    });
  }

  // Create a pending recruiter access request (minimal) for the graduate profile
  const grad = await prisma.graduateProfile.findUnique({ where: { userId: user.id } });
  if (grad) {
    await prisma.recruiterAccessRequest.create({
      data: {
        id: `seed-req-${Date.now()}`,
        graduateId: grad.id,
        recruiterName: 'Seed Recruiter',
        recruiterEmail: 'recruiter+seed@demo.talentos.local',
        recruiterOrganization: 'Seed Org',
        token: `seed-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        status: 'PENDING'
      }
    }).catch(() => undefined);
  }

  console.log('Evidence fixtures added (graduate profile, journal entry, recruiter request)');
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
