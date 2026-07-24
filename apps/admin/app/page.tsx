import Link from "next/link";
import { getTenantContext } from "@talentos/ui";
import { getTenantBySlug, listTenantApplications, listTenantPrograms, listTenantSubmissions } from "@talentos/db";

// Count a list of {status} rows into a status → count map.
function tally<T extends { status: string }>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
}

const APPLICATION_ORDER = [
  "ACCEPTED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "WAITLISTED",
  "REJECTED",
  "DISQUALIFIED",
  "AWAITING_MISSION_ASSIGNMENT",
  "DRAFT"
];
const APPLICATION_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Pending review",
  UNDER_REVIEW: "Under review",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WAITLISTED: "Waitlisted",
  DISQUALIFIED: "Disqualified",
  AWAITING_MISSION_ASSIGNMENT: "Awaiting mission"
};

const SUBMISSION_ORDER = ["ACCEPTED", "SUBMITTED", "NEEDS_REVISION", "REPEAT", "REVIEWED", "DRAFT"];
const SUBMISSION_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Pending review",
  REVIEWED: "Reviewed",
  NEEDS_REVISION: "Requested changes",
  ACCEPTED: "Accepted",
  REPEAT: "Repeat week"
};

const PROGRAM_ORDER = ["PUBLISHED", "DRAFT", "ARCHIVED"];
const PROGRAM_LABELS: Record<string, string> = { DRAFT: "Draft", PUBLISHED: "Published", ARCHIVED: "Archived" };

const CHIP: Record<string, string> = {
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  REVIEWED: "bg-slate-100 text-slate-600",
  NEEDS_REVISION: "bg-amber-100 text-amber-800",
  WAITLISTED: "bg-amber-100 text-amber-800",
  REPEAT: "bg-amber-100 text-amber-800",
  AWAITING_MISSION_ASSIGNMENT: "bg-amber-100 text-amber-800",
  REJECTED: "bg-rose-100 text-rose-700",
  DISQUALIFIED: "bg-rose-100 text-rose-700",
  DRAFT: "bg-slate-100 text-slate-600",
  ARCHIVED: "bg-slate-100 text-slate-600"
};

function chipClass(status: string): string {
  return CHIP[status] ?? "bg-slate-100 text-slate-600";
}

export default async function AdminOverviewPage() {
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);

  const [applications, programs, submissions] = tenant
    ? await Promise.all([
        listTenantApplications(tenant.id),
        listTenantPrograms(tenant.id),
        listTenantSubmissions(tenant.id, {})
      ])
    : [[], [], []];

  const appCounts = tally(applications);
  const programCounts = tally(programs);
  const subCounts = tally(submissions);

  const appAccepted = appCounts.ACCEPTED ?? 0;
  const appRejected = appCounts.REJECTED ?? 0;
  const appPending = (appCounts.SUBMITTED ?? 0) + (appCounts.UNDER_REVIEW ?? 0);
  const programsPublished = programCounts.PUBLISHED ?? 0;
  const subAccepted = subCounts.ACCEPTED ?? 0;
  const subPending = subCounts.SUBMITTED ?? 0;
  const subChanges = subCounts.NEEDS_REVISION ?? 0;
  const subRepeat = subCounts.REPEAT ?? 0;

  return (
    <>
      <h1 className="text-3xl font-bold">Overview</h1>
      <p className="mt-2 text-slate-600">
        Live snapshot of applications, programs and mission submissions for {tenantSlug}.
      </p>

      {/* Headline KPIs */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total applications"
          value={applications.length}
          sub={`${appAccepted} accepted · ${appRejected} rejected`}
          accent="text-brand-blue"
          href="/applications"
        />
        <StatTile
          label="Programs"
          value={programs.length}
          sub={`${programsPublished} published`}
          accent="text-brand-navy"
          href="/programs"
        />
        <StatTile
          label="Total submissions"
          value={submissions.length}
          sub={`${subAccepted} accepted`}
          accent="text-emerald-600"
          href="/submissions?status=ALL"
        />
        <StatTile
          label="Awaiting review"
          value={subPending}
          sub={`${appPending} applications · ${subChanges} changes requested`}
          accent="text-amber-600"
          href="/submissions?status=SUBMITTED"
        />
      </div>

      {/* Breakdowns */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <StatusBreakdown
          title="Applications"
          href="/applications"
          counts={appCounts}
          order={APPLICATION_ORDER}
          labels={APPLICATION_LABELS}
          emptyLabel="No applications yet."
        />
        <StatusBreakdown
          title="Submissions"
          href="/submissions?status=ALL"
          counts={subCounts}
          order={SUBMISSION_ORDER}
          labels={SUBMISSION_LABELS}
          emptyLabel="No submissions yet."
          footnote={subRepeat > 0 ? `${subRepeat} applicant${subRepeat === 1 ? "" : "s"} repeating a week` : undefined}
        />
        <StatusBreakdown
          title="Programs"
          href="/programs"
          counts={programCounts}
          order={PROGRAM_ORDER}
          labels={PROGRAM_LABELS}
          emptyLabel="No programs yet."
        />
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent = "text-brand-navy",
  href
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-blue hover:shadow-md"
    >
      {inner}
    </Link>
  ) : (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{inner}</div>
  );
}

function StatusBreakdown({
  title,
  href,
  counts,
  order,
  labels,
  emptyLabel,
  footnote
}: {
  title: string;
  href: string;
  counts: Record<string, number>;
  order: string[];
  labels: Record<string, string>;
  emptyLabel: string;
  footnote?: string;
}) {
  const total = order.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <Link href={href} className="text-sm font-medium text-brand-blue hover:underline">
          View →
        </Link>
      </div>
      {total === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-2">
          {order.map((key) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{labels[key] ?? key}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${chipClass(key)}`}>
                {counts[key] ?? 0}
              </span>
            </div>
          ))}
        </div>
      )}
      {footnote ? <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{footnote}</p> : null}
    </div>
  );
}
