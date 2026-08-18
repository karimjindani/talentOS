"use client";

import { useState } from "react";
import { ShieldCheck, ChevronRight, Lock } from "lucide-react";
import { GraduateProfileForm } from "./GraduateProfileForm";

interface GraduateConsentModalProps {
  userName?: string;
  missionRatings?: { name: string; rating: number }[];
  overallRating?: number;
  onPublish?: () => void;
  onDecline?: () => void;
  showProfileFormOnPublish?: boolean;
  /** Current consent status from the DB. When ACKNOWLEDGED the modal starts closed. */
  consentStatus?: "ACKNOWLEDGED" | "DECLINED" | "SKIPPED" | null;
}

export function GraduateConsentModal({
  userName,
  missionRatings,
  overallRating,
  onPublish,
  onDecline,
  showProfileFormOnPublish = true,
  consentStatus = null,
}: GraduateConsentModalProps) {
  const [step, setStep] = useState<"consent" | "form">("consent");
  const [isOpen, setIsOpen] = useState(consentStatus !== "ACKNOWLEDGED");
  const [isDeclining, setIsDeclining] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [declineSuccess, setDeclineSuccess] = useState(false);
  const [skipSuccess, setSkipSuccess] = useState(false);
  const [acknowledgeSuccess, setAcknowledgeSuccess] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const handlePublish = () => {
    if (showProfileFormOnPublish) {
      setStep("form");
      return;
    }

    // For the dashboard/consent-page flow (no profile form), record consent directly.
    acknowledgeConsent();
  };

  const acknowledgeConsent = async () => {
    setIsAcknowledging(true);
    setDeclineError(null);
    try {
      const response = await fetch("/api/graduates/profile/acknowledge", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to record consent.");
      setAcknowledgeSuccess(true);
      onPublish?.();
    } catch (error) {
      setDeclineError(error instanceof Error ? error.message : "Unable to record consent.");
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleFormSuccess = () => {
    onPublish?.();
    setIsOpen(false);
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    setDeclineError(null);
    try {
      const response = await fetch("/api/graduates/profile/decline", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to decline consent.");
      onDecline?.();
      setDeclineSuccess(true);
    } catch (error) {
      setDeclineError(error instanceof Error ? error.message : "Unable to decline consent.");
    } finally {
      setIsDeclining(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    setDeclineError(null);
    try {
      const response = await fetch("/api/graduates/profile/skip", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to skip consent.");
      onDecline?.();
      setSkipSuccess(true);
    } catch (error) {
      setDeclineError(error instanceof Error ? error.message : "Unable to skip consent.");
    } finally {
      setIsSkipping(false);
    }
  };

  if (!isOpen) {
    // When previously acknowledged, offer a button to re-open and change the decision.
    if (consentStatus === "ACKNOWLEDGED") {
      return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-sm font-medium text-emerald-700">
            ✅ You have already given consent. Your profile is visible to recruiters.
          </p>
          <button
            type="button"
            onClick={() => {
              setAcknowledgeSuccess(false);
              setDeclineSuccess(false);
              setSkipSuccess(false);
              setIsOpen(true);
            }}
            className="mt-3 inline-flex rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            Change my decision
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        {step === "consent" ? (
          <div className="space-y-6 p-8">
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-blue/10 text-brand-blue">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900">Share Your Progress with Recruiters</h2>
              <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-600">
                By giving consent, you allow TalentOS to display your profile and verified portfolio details in the Recruiter Portal. Recruiters will only see the work and progress you approve for hiring purposes.
              </p>
              {(userName || overallRating !== undefined || missionRatings?.length) ? (
                <div className="mx-auto mt-6 max-w-2xl rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                  {userName ? <p className="font-semibold text-slate-900">Applicant: {userName}</p> : null}
                  {overallRating !== undefined ? (
                    <p className="mt-2">Overall reviewer rating: <span className="font-semibold text-slate-900">{overallRating.toFixed(1)}</span></p>
                  ) : null}
                  {missionRatings?.length ? (
                    <div className="mt-3 space-y-2">
                      <p className="font-semibold text-slate-900">Mission ratings</p>
                      <ul className="space-y-1 text-slate-600">
                        {missionRatings.map((mission) => (
                          <li key={mission.name}>
                            {mission.name}: <span className="font-medium text-slate-900">{mission.rating}/10</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {declineSuccess ? (
              <div className="space-y-5 rounded-3xl border border-slate-200 bg-emerald-50 p-5 text-slate-700">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">You have declined recruiter visibility</h3>
                  <p className="mt-2 text-sm">
                    Your profile will remain private and will not be shared with verified recruiters. You can return to this page anytime to consent and publish your graduate profile.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center justify-center rounded-3xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Return to dashboard
                  </button>
                </div>
              </div>
            ) : skipSuccess ? (
              <div className="space-y-5 rounded-3xl border border-slate-200 bg-amber-50 p-5 text-slate-700">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Decision saved — you can decide later</h3>
                  <p className="mt-2 text-sm">
                    Your consent status has been saved as <span className="font-semibold">Skipped / Not Decided</span>. Your profile will remain unpublished until you provide a decision. You can return to this page anytime to acknowledge or decline.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center justify-center rounded-3xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Return to dashboard
                  </button>
                </div>
              </div>
            ) : acknowledgeSuccess ? (
              <div className="space-y-5 rounded-3xl border border-slate-200 bg-emerald-50 p-5 text-slate-700">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Consent recorded — thank you!</h3>
                  <p className="mt-2 text-sm">
                    Your consent has been saved. Your profile will be published on the public TalentOS
                    graduate portal once you complete your training program. You can change this decision
                    anytime from the <span className="font-semibold">Consent Form</span> page in your sidebar.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center justify-center rounded-3xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Return to dashboard
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { title: "Your Public Profile", description: "Name, bio, photo, and public summary visible to recruiters." },
                    { title: "GitHub Links", description: "Your GitHub profile and repository links." },
                    { title: "Submitted Tasks", description: "Your completed task evidence and progress updates." },
                    { title: "Project Progress", description: "Your learning journey, milestones, and achievements." },
                    { title: "Loom Videos", description: "Videos you have shared for assessments or projects." },
                    { title: "For Recruitment Purpose", description: "Only relevant portfolio information is shared with verified recruiters." },
                  ].map((item) => (
                    <div key={item.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
                        <ChevronRight className="h-4 w-4 text-brand-blue" />
                        <span>{item.title}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 h-5 w-5 text-brand-blue" />
                    <div>
                      <p className="font-semibold text-slate-900">Your privacy matters</p>
                      <p className="mt-1">Your information will only be shared with verified recruiters and will not be visible on public search engines or unrelated platforms.</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {declineError ? (
              <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{declineError}</div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleDecline}
                disabled={isDeclining}
                className="inline-flex items-center justify-center rounded-3xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeclining ? "Declining…" : "Decline"}
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSkipping}
                className="inline-flex items-center justify-center rounded-3xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSkipping ? "Saving…" : "Skip for Now"}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isAcknowledging}
                className="inline-flex items-center justify-center rounded-3xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:ml-auto"
              >
                {isAcknowledging ? "Saving…" : "I Agree & Continue"}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-[90vh] overflow-y-auto p-8">
            <div className="mb-6">
              <button
                onClick={() => setStep("consent")}
                className="text-sm font-medium text-brand-blue hover:text-blue-700"
              >
                ← Back
              </button>
            </div>
            <GraduateProfileForm onSuccess={handleFormSuccess} />
          </div>
        )}
      </div>
    </div>
  );
}
