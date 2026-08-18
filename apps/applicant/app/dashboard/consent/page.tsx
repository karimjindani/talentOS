import { auth } from "@/auth";
import { GraduateConsentModal } from "@/components/GraduateConsentModal";
import { getGraduateEligibility, getUserByEmail, prisma } from "@talentos/db";
import Link from "next/link";

export default async function ConsentPage() {
  const session = await auth();
  const user = session?.user?.email ? await getUserByEmail(session.user.email) : null;
  if (!user) return null;

  const profile = await prisma.graduateProfile.findUnique({
    where: { userId: user.id },
    select: { publicProfileEnabled: true, consentStatus: true },
  });

  const eligibility = await getGraduateEligibility(user.id).catch(() => null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-navy">Recruiter Visibility Consent</h1>
        <p className="mt-2 text-slate-600">
          Review and manage your consent for sharing your profile with verified recruiters on the
          public TalentOS graduate portal.
        </p>
      </div>

      {/* Current status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Current Status</h2>
        <div className="mt-3 flex items-center gap-3">
          {profile?.consentStatus === "ACKNOWLEDGED" || profile?.publicProfileEnabled ? (
            <>
              <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-emerald-700">
                Consent given — your profile is visible to recruiters.
              </span>
            </>
          ) : profile?.consentStatus === "DECLINED" ? (
            <>
              <span className="inline-flex h-3 w-3 rounded-full bg-rose-500" />
              <span className="text-sm font-medium text-rose-700">
                You declined — your profile is private. You can acknowledge below to make it public.
              </span>
            </>
          ) : profile?.consentStatus === "SKIPPED" ? (
            <>
              <span className="inline-flex h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-sm font-medium text-amber-700">
                Skipped — you can decide below.
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex h-3 w-3 rounded-full bg-slate-400" />
              <span className="text-sm font-medium text-slate-600">
                No decision yet — please review and decide below.
              </span>
            </>
          )}
        </div>
      </div>

      {/* Consent modal (always visible on this page) */}
      <GraduateConsentModal
        userName={user.name ?? user.email.split("@")[0]}
        missionRatings={eligibility?.eligible ? eligibility.missionRatings : undefined}
        overallRating={eligibility?.eligible ? eligibility.overallRating : undefined}
        showProfileFormOnPublish={false}
        consentStatus={profile?.consentStatus ?? null}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        <p>
          Your profile will only appear on the public portal once you acknowledge consent{" "}
          <strong>and</strong> complete your training program. If you have already acknowledged,
          you can update your profile details on the{" "}
          <Link href="/dashboard/graduate-profile" className="font-semibold text-brand-blue hover:underline">
            Graduate Profile
          </Link>{" "}
          page.
        </p>
      </div>
    </div>
  );
}
