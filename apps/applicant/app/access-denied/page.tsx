import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { buildEndSessionUrl } from "@talentos/auth-web";

// Standalone page under the ROOT layout (not the dashboard shell), so the membership guard can
// redirect here without a loop. Shown when an authenticated user has no membership in the
// tenant resolved from the current subdomain.
export default async function AccessDeniedPage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-3 text-slate-600">
          You are not a member of this organization. If you would like to join, you can submit an
          application below.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/apply"
            className="rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white transition-colors hover:bg-brand-navy"
          >
            Apply to join
          </Link>
          {session?.user ? (
            <form
              action={async () => {
                "use server";
                const activeSession = await auth();
                // Return to the tenant subdomain the user is actually on (AUTH_URL is not pinned;
                // the request Host header is the source of truth). See v0.12.1 / D-060.
                const requestHeaders = await headers();
                const host = requestHeaders.get("host") ?? "localhost:3100";
                const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
                const logoutUrl = buildEndSessionUrl({
                  issuer: process.env.KEYCLOAK_ISSUER ?? "http://keycloak.lvh.me:8080/realms/talentos",
                  idToken: activeSession?.idToken,
                  clientId: process.env.KEYCLOAK_CLIENT_ID ?? "talentos-applicant",
                  postLogoutRedirectUri: `${proto}://${host}/`
                });
                await signOut({ redirect: false });
                redirect(logoutUrl);
              }}
            >
              <button
                type="submit"
                className="w-full cursor-pointer rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </main>
  );
}
