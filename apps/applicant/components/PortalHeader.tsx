import Link from "next/link";

type PortalHeaderProps = {
  tenantSlug: string;
};

export function PortalHeader({ tenantSlug }: PortalHeaderProps) {
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
          <Link href="/login">Login</Link>
        </nav>
      </div>
    </header>
  );
}
