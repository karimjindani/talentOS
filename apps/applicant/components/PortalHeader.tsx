import Link from "next/link";
import { auth, signOut } from "@/auth";

type PortalHeaderProps = {
  tenantSlug: string;
};

export async function PortalHeader({ tenantSlug }: PortalHeaderProps) {
  const session = await auth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-semibold text-brand-navy">
          TalentOS
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <span className="rounded-full bg-brand-mist px-3 py-1 text-brand-blue">
            Tenant: {tenantSlug}
          </span>
          <Link href="/apply">Apply</Link>
          {session?.user ? (
            <>
              <span className="text-slate-500">{session.user.email}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="text-brand-blue">
                  Logout
                </button>
              </form>
            </>
          ) : (
            <Link href="/login">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
