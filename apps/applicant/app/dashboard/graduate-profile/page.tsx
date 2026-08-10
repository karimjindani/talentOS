import { auth } from "@/auth";
import { GraduateConsentModal } from "@/components/GraduateConsentModal";
import { getGraduateEligibility, getUserByEmail } from "@talentos/db";

export default async function GraduateProfilePage() {
  const session = await auth();
  const user = session?.user?.email ? await getUserByEmail(session.user.email) : null;
  if (!user) return null;

  const eligibility = await getGraduateEligibility(user.id);
  if (!eligibility.eligible) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-bold">Graduate profile is not ready yet</h1>
        <p className="mt-2 text-sm leading-6">{eligibility.reason}</p>
        <p className="mt-2 text-sm">A reviewer must accept and score each of the four missions before consent can be recorded.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-navy">Recruiter portal consent</h1>
        <p className="mt-2 text-slate-600">Review your verified results and choose whether to make your profile visible to verified recruiters.</p>
      </div>
      <GraduateConsentModal
        userName={user.name ?? user.email.split("@")[0]}
        missionRatings={eligibility.missionRatings}
        overallRating={eligibility.overallRating}
        onPublish={() => {
          /* nothing additional required; user will complete profile form */
        }}
        onDecline={() => {
          /* no-op: user explicitly declined consent */
        }}
      />
    </div>
  );
}
