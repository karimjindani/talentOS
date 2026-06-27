import { auth, signOut } from "@/auth";

export default async function ForbiddenPage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-3 text-slate-600">
          Your account does not have an administrator role for this portal. The Admin Portal is limited to
          organization admins, HR, tech leads and platform super admins.
        </p>
        {session?.user ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/forbidden" });
            }}
            className="mt-6"
          >
            <button type="submit" className="rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white">
              Sign out
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
