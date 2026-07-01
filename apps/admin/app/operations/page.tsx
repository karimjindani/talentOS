import { can, LOCAL_REGRESSION_COMMANDS, LOCAL_RESET_COMMANDS } from "@talentos/auth";
import { auth } from "@/auth";
import { HealthPanel } from "./HealthPanel";

const localUrls = [
  ["Applicant Portal", "http://localhost:3100"],
  ["Admin Portal", "http://localhost:3200"],
  ["Keycloak", "http://localhost:8080"],
  ["MinIO Console", "http://localhost:9001"]
] as const;

export default async function OperationsPage() {
  const session = await auth();
  const allowed = can("manageTenantUsers", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });

  if (!allowed) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-3xl font-bold">Operations</h1>
        <p className="mt-3 text-amber-800">Operations are limited to SUPER_ADMIN and ORG_ADMIN users.</p>
      </section>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold">Local development operations</h1>
      <p className="mt-2 text-slate-600">
        The primary control surface is now the out-of-band local Ops console, which runs outside this Admin app so it
        can still diagnose the stack when Admin or Keycloak is down.
      </p>

      <div className="mt-8 grid gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Out-of-band Ops console</h2>
          <p className="mt-1 text-sm text-slate-600">
            Start it from the repository root with <code>npm.cmd run ops:start</code>, then open{" "}
            <a className="text-brand-blue underline" href="http://127.0.0.1:3300">
              http://127.0.0.1:3300
            </a>
            . It uses Keycloak login and the Ops Console 2FA toggle for access control.
          </p>
        </section>
        <HealthPanel />
        <CommandSection
          title="Run regression tests"
          description="Run the regression suite from the repository root. Current baseline expectation: 33 tests pass."
          commands={[LOCAL_REGRESSION_COMMANDS.runTests]}
        />
        <CommandSection
          title="Cleanup regression testing generated data"
          description="Deletes only records explicitly tagged in regression_data_markers. Unmarked user-created and seeded data is left intact."
          commands={[LOCAL_REGRESSION_COMMANDS.cleanupRegressionData, LOCAL_REGRESSION_COMMANDS.cleanupRegressionRun]}
        />
        <CommandSection
          title="Reset local platform to fresh deployment state"
          description="Recreates only TalentOS Docker Compose resources, then rebuilds, migrates and seeds. Do not run this if you want to preserve local TalentOS user data."
          commands={[...LOCAL_RESET_COMMANDS]}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Local URLs</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {localUrls.map(([label, href]) => (
              <a className="rounded-xl border border-slate-100 p-4 text-brand-blue" href={href} key={href}>
                <span className="block font-medium text-slate-700">{label}</span>
                <span className="text-sm">{href}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function CommandSection({
  title,
  description,
  commands
}: {
  title: string;
  description: string;
  commands: readonly string[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4 space-y-3">
        {commands.map((command) => (
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-50" key={command}>
            <code>{command}</code>
          </pre>
        ))}
      </div>
    </section>
  );
}
