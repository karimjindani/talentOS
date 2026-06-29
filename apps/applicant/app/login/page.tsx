"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function KeycloakAuthButtons() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/application";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => signIn("keycloak", { callbackUrl })}
        className="w-full rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white"
      >
        Sign in with Keycloak
      </button>
      <button
        type="button"
        onClick={() => signIn("keycloak", { callbackUrl }, { prompt: "create" })}
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
