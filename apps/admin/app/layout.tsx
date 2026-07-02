import type { Metadata } from "next";
import Link from "next/link";
import { SessionProvider } from "next-auth/react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getTenantContext, brandStyleBlock } from "@talentos/ui";
import { buildEndSessionUrl } from "@talentos/auth-web";
import { getTenantBySlug } from "@talentos/db";
import { resolveTenantAccess } from "@/lib/tenant-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin Portal",
  description: "Program administration portal for TalentOS tenant owners and admins"
};

const applicantUrl = process.env.NEXT_PUBLIC_APPLICANT_URL ?? "http://localhost:3100";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const roleLabel = session?.user
    ? session.user.isSuperAdmin
      ? "SUPER_ADMIN"
      : (session.user.orgRole ?? "—")
    : null;

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const tenantName = tenant?.name ?? "TalentOS";

  // Tenant-authorization gate: a signed-in admin may only view a tenant they belong to (or be a
  // SUPER_ADMIN). Rendered as an inline notice rather than a redirect so /forbidden itself — which
  // shares this layout — cannot cause a redirect loop. Server actions and route handlers enforce the
  // same rule independently. See lib/tenant-guard.ts (D-051).
  const access = session?.user ? await resolveTenantAccess() : { ok: true as const };

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandStyleBlock(tenant) }} />
      </head>
      <body>
        <SessionProvider>
          <div className="min-h-screen bg-slate-100">
            <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white p-6 md:flex">
              <h1 className="text-xl font-bold">{tenantName} Admin</h1>
              <nav className="mt-8 grid gap-3 text-sm text-slate-700">
                <Link href="/">Overview</Link>
                <Link href="/applications">Applications</Link>
                <Link href="/programs">Programs</Link>
                <Link href="/operations">Operations</Link>
                <Link href="/settings">Settings</Link>
                {session?.user?.isSuperAdmin ? (
                  <Link href="/organizations">Organizations</Link>
                ) : null}
                <a className="mt-4 text-brand-blue" href={applicantUrl}>
                  Applicant portal
                </a>
              </nav>
              {session?.user ? (
                <div className="mt-auto border-t border-slate-200 pt-4 text-sm">
                  <p className="font-medium text-slate-700">{session.user.email}</p>
                  <p className="text-slate-500">{roleLabel}</p>
                  <form
                    action={async () => {
                      "use server";
                      const activeSession = await auth();
                      const logoutUrl = buildEndSessionUrl({
                        issuer: process.env.KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/talentos",
                        idToken: activeSession?.idToken,
                        clientId: process.env.KEYCLOAK_CLIENT_ID ?? "talentos-admin",
                        postLogoutRedirectUri: `${process.env.AUTH_URL ?? "http://localhost:3200"}/`
                      });
                      await signOut({ redirect: false });
                      redirect(logoutUrl);
                    }}
                    className="mt-2"
                  >
                    <button type="submit" className="text-brand-blue">
                      Logout
                    </button>
                  </form>
                </div>
              ) : null}
            </aside>
            <main className="md:pl-64">
              <div className="mx-auto max-w-6xl px-6 py-8">
                {access.ok ? (
                  children
                ) : (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
                    <h1 className="text-xl font-semibold">Access denied</h1>
                    <p className="mt-2 text-sm">
                      Your account is not a member of this organization. Switch to an organization you
                      belong to, or contact a platform administrator.
                    </p>
                  </div>
                )}
              </div>
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
