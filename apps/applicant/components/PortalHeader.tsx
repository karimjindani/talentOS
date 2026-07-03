import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { buildEndSessionUrl } from "@talentos/auth-web";
import { getTenantBySlug } from "@talentos/db";

type PortalHeaderProps = {
  tenantSlug: string;
};

export async function PortalHeader({ tenantSlug }: PortalHeaderProps) {
  const session = await auth();
  const tenant = await getTenantBySlug(tenantSlug);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-brand-navy">
          {tenant?.logoFileId ? (
            <img src="/api/branding/logo" alt={tenant.name} className="h-8 w-auto" />
          ) : (
            <span>{tenant?.name ?? "TalentOS"}</span>
          )}
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/apply"
            className="rounded-lg px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-blue"
          >
            Apply
          </Link>
          {session?.user ? (
            <>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                {session.user.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  const activeSession = await auth();
                  const logoutUrl = buildEndSessionUrl({
                    issuer: process.env.KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/talentos",
                    idToken: activeSession?.idToken,
                    clientId: process.env.KEYCLOAK_CLIENT_ID ?? "talentos-applicant",
                    postLogoutRedirectUri: `${process.env.AUTH_URL ?? "http://localhost:3100"}/`
                  });
                  await signOut({ redirect: false });
                  redirect(logoutUrl);
                }}
              >
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-navy"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
