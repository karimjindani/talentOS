import { auth } from "@/auth";
import { GraduateConsentModal } from "@/components/GraduateConsentModal";
import { getGraduateEligibility, getUserByEmail, prisma } from "@talentos/db";

export default async function GraduateProfilePage() {
  const session = await auth();
  const user = session?.user?.email ? await getUserByEmail(session.user.email) : null;
  if (!user) return null;

  const profile = await prisma.graduateProfile.findUnique({
    where: { userId: user.id },
    select: { publicProfileEnabled: true, consentStatus: true, bio: true, linkedinUrl: true, githubUrl: true },
  });

  const eligibility = await getGraduateEligibility(user.id).catch(() => null);
  const isEligible = eligibility?.eligible ?? false;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-navy">Graduate Profile</h1>
        <p className="mt-2 text-slate-600">
          Review your verified results and manage your recruiter visibility consent.
        </p>
      </div>

      {/* Status card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Profile Status</h2>
        {profile?.publicProfileEnabled ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">
              Your profile is public and visible to recruiters.
            </span>
          </div>
        ) : profile?.consentStatus === "ACKNOWLEDGED" ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-sm font-medium text-blue-700">
              Consent recorded. Your profile will publish automatically once you complete your training.
            </span>
          </div>
        ) : profile?.consentStatus === "DECLINED" ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex h-3 w-3 rounded-full bg-rose-500" />
            <span className="text-sm font-medium text-rose-700">
              You declined consent. Your profile is private.
            </span>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-700">
              No consent decision yet. Please review and decide below.
            </span>
          </div>
        )}
      </div>

      {/* Consent modal */}
      <GraduateConsentModal
        userName={user.name ?? user.email.split("@")[0]}
        missionRatings={isEligible ? eligibility?.missionRatings : undefined}
        overallRating={isEligible ? eligibility?.overallRating : undefined}
        showProfileFormOnPublish={isEligible}
        consentStatus={profile?.consentStatus ?? null}
      />

      {!isEligible && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-sm text-blue-700">
          <p className="font-semibold">Training in progress</p>
          <p className="mt-1">
            Your profile will appear on the public portal once you complete your training program
            with four accepted missions. You can give consent now — it will be applied automatically
            when your training is complete.
          </p>
        </div>
      )}
    </div>
  );
}
