"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function KeycloakSignInButton() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/application";

  return (
    <button
      type="button"
      onClick={() => signIn("keycloak", { callbackUrl })}
      className="w-full rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white"
    >
      Sign in with Keycloak
    </button>
  );
}

export default function LoginPage() {
  return (
    <main>
      <section className="mx-auto max-w-xl px-6 py-20">
        <h1 className="text-3xl font-bold">Login</h1>
        <p className="mt-3 text-slate-600">
          TalentOS uses Keycloak for secure sign-in, password policy and authenticator-app 2FA.
        </p>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Suspense fallback={null}>
            <KeycloakSignInButton />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
