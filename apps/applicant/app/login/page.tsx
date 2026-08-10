"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { resolveCallbackUrl } from "@/lib/login-callback";

function KeycloakAuthButtons() {
  const params = useSearchParams();
  // Default callbackUrl is /application; middleware/dashboard layout will redirect to /dashboard
  // if the user has an accepted application.
  const rawCallbackUrl = params.get("callbackUrl") ?? "/application";

  // Build an absolute callback URL using the current (tenant) host so the post-login redirect
  // returns the user to their own tenant subdomain rather than the canonical AUTH_URL host.
  // When the callbackUrl is already absolute (e.g. set by middleware), use it as-is.
  // window is only available in the browser, so this is computed at click time.
  const handleClick = () => signIn("keycloak", { callbackUrl: resolveCallbackUrl(rawCallbackUrl) });
  const handleCreate = () => signIn("keycloak", { callbackUrl: resolveCallbackUrl(rawCallbackUrl) }, { prompt: "create" });

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        className="w-full rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white"
      >
        Sign in with Keycloak
      </button>
      <button
        type="button"
        onClick={handleCreate}
        className="w-full rounded-xl border border-brand-blue px-5 py-3 font-semibold text-brand-blue"
      >
        Create account
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main>
      <section className="mx-auto max-w-xl px-6 py-20">
        <h1 className="text-3xl font-bold">Login</h1>
        <p className="mt-3 text-slate-600">
          TalentOS uses Keycloak for secure sign-in, self-service registration, password policy and
          authenticator-app 2FA. New applicants can create an account, then sign in to apply.
        </p>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Suspense fallback={null}>
            <KeycloakAuthButtons />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
