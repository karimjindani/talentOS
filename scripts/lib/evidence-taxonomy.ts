/**
 * The single source of truth for how E2E evidence is bucketed (`v0.20.13`, D-112).
 *
 * Before this module the 5-process list was hand-duplicated in `tests/journeys/fixtures/types.ts`
 * and `scripts/ci/journey-pdf-report.ts`, each carrying a "keep in sync by hand" comment — and
 * `groupByProcess` drops steps whose tag matches nothing, so drift silently lost evidence instead
 * of failing. Tagging `scripts/regression/run.ts` too would have made a third copy, so the list
 * moved here instead.
 *
 * This file must stay **dependency-free**: no workspace packages, no Prisma, no node built-ins
 * beyond types. `journey-pdf-report.ts` is contractually non-throwing and runs against the JSON
 * contract alone (see its header); importing a constants-only sibling preserves that, whereas
 * importing `@talentos/auth` — where `RegressionArea` lives — would not.
 */

/**
 * The 5 named business processes evidence is grouped and reported by (`v0.20.5`) — one PDF per
 * process, not one per spec file. Order here is report order.
 */
export const PROCESSES = [
  "Applicant Signup & Approval",
  "Mission Acceptance & Journal",
  "Submission & Mission Acceptance",
  "Final Mission & Public Profile",
  "Recruiter Journey"
] as const;

export type Process = (typeof PROCESSES)[number];

/**
 * Regression scenarios that guard the platform itself rather than one business process — the unit
 * suite, Keycloak realm discovery, the Ops Console, cross-portal cookie isolation, storage.
 *
 * It is deliberately NOT a `Process`: no journey step is ever tagged with it and it gets no PDF of
 * its own. Instead these rows render as a short shared block inside every process report, so each
 * report stays self-contained without pretending platform checks belong to one process.
 */
export const PLATFORM = "Platform & Cross-Cutting" as const;

export type Scope = Process | typeof PLATFORM;

export const SCOPES: readonly Scope[] = [...PROCESSES, PLATFORM];

/**
 * Short aliases for tagging scenarios, so `scripts/regression/run.ts` reads `scopes: [SCOPE.SMA]`
 * rather than repeating a 31-character string literal 21 times. One definition, no free-typed
 * process names in the runner.
 */
export const SCOPE = {
  ASA: "Applicant Signup & Approval",
  MAJ: "Mission Acceptance & Journal",
  SMA: "Submission & Mission Acceptance",
  FMP: "Final Mission & Public Profile",
  RJ: "Recruiter Journey",
  PLT: PLATFORM
} as const satisfies Record<string, Scope>;

/**
 * TC ID segment per regression area: a scenario's ID is `TOS-<AREA>-<NN>`.
 *
 * Anchored to `area`, deliberately **not** to `scopes`. `area` is the runner's own stable
 * partition — it names the twelve `regression:*` npm scripts and never moves. A `scopes` tag is a
 * reporting decision that will be refined as the mapping is revisited, so an ID keyed on it would
 * renumber the first time a scenario moved between processes, and a renumbered ID breaks every
 * external reference to a test case, which is the whole reason the IDs exist.
 *
 * Numbers are assigned in first-registration order within an area and never reclaimed: a deleted
 * scenario retires its number, a new one takes `max(existing) + 1`. Renaming a scenario does not
 * touch its ID — the ID is the join key, the name is prose.
 */
export const AREA_CODE: Record<string, string> = {
  unit: "UNI",
  auth: "AUT",
  ops: "OPS",
  applicant: "APP",
  admin: "ADM",
  programs: "PRG",
  missions: "MIS",
  journal: "JNL",
  tenant: "TEN",
  dashboard: "DSH",
  storage: "STO",
  "public-portal": "PUB"
};

const TC_ID_PATTERN = /^TOS-[A-Z]{3}-\d{2}$/;

export const PROCESS_DESCRIPTIONS: Record<Process, string> = {
  "Applicant Signup & Approval": "Keycloak signup, application submission, and org-admin acceptance.",
  "Mission Acceptance & Journal":
    "Accepting each weekly mission and writing the required engineering journal entries.",
  "Submission & Mission Acceptance":
    "Evidence submission and reviewer decisions for weeks 1-3, including the revision loop week 1 proves.",
  "Final Mission & Public Profile":
    "Accepting the 4th and final mission, consenting to publish, and confirming public visibility.",
  "Recruiter Journey": "The recruiter access-request lifecycle end to end, across both portals."
};

export const PLATFORM_DESCRIPTION =
  "Checks that guard the platform as a whole rather than one business process. The same rows appear in every report.";

/**
 * What each scope is known NOT to cover, stated in the report so it declares its own limits
 * (the reference report's "Pending items").
 *
 * Curated by hand rather than parsed out of `docs/Regression_Scenarios.md`, which carries ~8
 * per-version "Known Gaps" sections plus a global one — a parser over that would be guessing.
 * Scenarios that are *skipped at runtime* are added automatically by the report from their own
 * skip reason, so they do not belong here.
 *
 * Keep this in step with `docs/Regression_Scenarios.md` Known Gaps during the SSDLC doc pass.
 */
export const KNOWN_GAPS: Record<Scope, readonly string[]> = {
  "Applicant Signup & Approval": [
    "Reviewer-specific rejected and waitlisted transitions have no scenario coverage — only acceptance is automated.",
    "Role-specific UI and route denial for HR, Tech Lead and Applicant is covered by unit/RBAC tests, not scenarios."
  ],
  "Mission Acceptance & Journal": [
    "3 applicant work-in-progress screenshots in `docs-only.spec.ts` are `test.fixme()` and capture nothing."
  ],
  "Submission & Mission Acceptance": [
    "Evidence-URL reachability is asserted through a deterministic stub, not a live network fetch."
  ],
  "Final Mission & Public Profile": [
    "Graduate profile rendering is asserted at the data layer; exact public-page DOM assertions are deferred."
  ],
  "Recruiter Journey": [
    "The recruiter access token is injected via Prisma after each real state transition — no mailbox-capture harness exists, so the emailed link itself is never exercised."
  ],
  [PLATFORM]: [
    "Playwright traces and videos (`retain-on-failure`) are produced but not uploaded, so a CI failure has no trace to replay.",
    "`scripts/regression/run.ts` is not covered by `npm run typecheck`; its TC IDs are validated at runtime by `assertScenarioCatalog`, not by the type checker."
  ]
};

export function isProcess(value: string): value is Process {
  return (PROCESSES as readonly string[]).includes(value);
}

export function isScope(value: string): value is Scope {
  return value === PLATFORM || isProcess(value);
}

/** The minimum a regression scenario must declare to be reportable. */
export type ScenarioCatalogEntry = {
  id: string;
  area: string;
  scopes: readonly Scope[];
};

/**
 * Fails loudly on a malformed scenario catalog.
 *
 * Called from `scripts/regression/run.ts`'s `main()` — which is the CI gate step — because that
 * file is not typechecked and has no test file of its own. Living here keeps it unit-testable
 * against synthetic input without importing the 4,000-line runner (and its Prisma client).
 *
 * Throws rather than warns: a duplicate or mis-prefixed TC ID silently mis-files evidence, and
 * this runs on the gate, not in a reporting script bound by the non-throwing contract.
 */
export function assertScenarioCatalog(entries: readonly ScenarioCatalogEntry[]): void {
  const problems: string[] = [];
  const seen = new Map<string, number>();

  entries.forEach((entry, position) => {
    const where = `scenario #${position + 1}${entry.id ? ` (${entry.id})` : ""}`;

    if (!entry.id) {
      problems.push(`${where} has no TC ID.`);
    } else {
      if (!TC_ID_PATTERN.test(entry.id)) {
        problems.push(`${where} has a malformed TC ID — expected TOS-XXX-NN.`);
      }
      const expected = AREA_CODE[entry.area];
      if (!expected) {
        problems.push(`${where} is in area "${entry.area}", which has no TC ID code in AREA_CODE.`);
      } else if (!entry.id.startsWith(`TOS-${expected}-`)) {
        problems.push(`${where} is in area "${entry.area}", so its TC ID must start with "TOS-${expected}-".`);
      }
      const previous = seen.get(entry.id);
      if (previous !== undefined) {
        problems.push(`${where} reuses TC ID ${entry.id}, already used by scenario #${previous + 1}.`);
      } else {
        seen.set(entry.id, position);
      }
    }

    if (entry.scopes.length === 0) {
      problems.push(`${where} declares no scopes — every scenario must name at least one.`);
      return;
    }

    for (const scope of entry.scopes) {
      if (!isScope(scope)) problems.push(`${where} names an unknown scope "${scope}".`);
    }
  });

  if (problems.length > 0) {
    throw new Error(`Regression scenario catalog is invalid:\n  - ${problems.join("\n  - ")}`);
  }
}
