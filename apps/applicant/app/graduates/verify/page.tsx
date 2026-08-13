"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [errorTitle, setErrorTitle] = useState("Verification Failed");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [canResubmit, setCanResubmit] = useState(false);
  const token = searchParams.get("token");

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus("error");
        setMessage("No verification token provided");
        return;
      }

      try {
        const response = await fetch("/api/graduates/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.rejectionReason) {
            setRejectionReason(data.rejectionReason);
          }
          throw new Error(data.error || "Verification failed");
        }

        setStatus("success");
        setMessage("Email verified! Redirecting to portfolio...");

        // Redirect to full portfolio after 2 seconds
        setTimeout(() => {
          router.replace(`/graduates/${data.slug}/portfolio`);
        }, 2000);
      } catch (err) {
        setStatus("error");
        const errMsg = err instanceof Error ? err.message : "Verification failed";
        setMessage(errMsg);
        if (errMsg.includes("expired")) {
          setErrorTitle("Access Expired");
          setCanResubmit(true);
        } else if (errMsg.includes("revoked")) {
          setErrorTitle("Access Revoked");
          setCanResubmit(true);
        } else if (errMsg.includes("pending")) {
          setErrorTitle("Access Pending Review");
        } else if (errMsg.includes("rejected")) {
          setErrorTitle("Request Rejected");
          setCanResubmit(true);
        } else {
          setErrorTitle("Verification Failed");
        }
      }
    };

    verifyToken();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="text-xl font-bold text-brand-navy">TalentOS</div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-md px-6 py-24">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          {status === "loading" && (
            <>
              <Loader className="mx-auto h-12 w-12 animate-spin text-brand-blue" />
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Verifying Email...</h2>
              <p className="mt-2 text-slate-600">Please wait while we verify your identity</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                Email Verified!
              </h2>
              <p className="mt-2 text-slate-600">{message}</p>
              <div className="mt-4">
                <div className="inline-block h-2 w-2 rounded-full bg-green-600 animate-pulse" />
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                {errorTitle}
              </h2>
              <p className="mt-2 text-slate-600">{message}</p>

              {rejectionReason && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-left">
                  <p className="text-sm font-semibold text-rose-800">Reason from administrator:</p>
                  <p className="mt-1 text-sm text-rose-700">{rejectionReason}</p>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={() => router.push("/graduates")}
                  className="rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Back to Directory
                </button>
                {canResubmit && (
                  <button
                    onClick={() => router.push("/graduates")}
                    className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Submit a New Access Request
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
