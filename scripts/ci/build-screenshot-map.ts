#!/usr/bin/env tsx
/**
 * Builds a screenshot→TC→step mapping based on the known capture-screenshots.ts flow.
 * Each screenshot is mapped to the TC that logically covers that UI flow.
 * Screenshots that are purely documentation (no regression TC) are marked as such.
 *
 * Usage: npx tsx scripts/ci/build-screenshot-map.ts [runId]
 * Output: .ops/evidence/<runId>/screenshots-map.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const runId = process.argv[2] ?? 'latest';
const outDir = resolve('.ops', 'evidence', runId);
mkdirSync(outDir, { recursive: true });

// Mapping based on capture-screenshots.ts sections and regression scenario names.
// Only screenshots with a clear logical relationship to a regression TC are mapped.
const mapping: Record<string, Array<{ step: number; file: string; caption: string }>> = {
  'TC-AUTH-applicant-can-complete-applicant-portal-login': [
    { step: 1, file: '02-applicant-login.png', caption: 'Applicant login page' },
    { step: 2, file: '03-keycloak-signin.png', caption: 'Keycloak authentication form' },
  ],
  'TC-AUTH-accepted-applicant-can-reach-dashboard': [
    { step: 1, file: '06-dashboard-overview.png', caption: 'Accepted applicant dashboard loaded' },
  ],
  'TC-DASHBOARD-accepted-applicant-dashboard-pages-load': [
    { step: 1, file: '06-dashboard-overview.png', caption: 'Dashboard overview' },
    { step: 2, file: '07-dashboard-missions.png', caption: 'Dashboard missions page' },
    { step: 3, file: '09-dashboard-tasks.png', caption: 'Dashboard tasks page' },
    { step: 4, file: '10-dashboard-resources.png', caption: 'Dashboard resources page' },
    { step: 5, file: '11-dashboard-calendar.png', caption: 'Dashboard calendar page' },
    { step: 6, file: '12-dashboard-notifications.png', caption: 'Dashboard notifications page' },
    { step: 7, file: '13-dashboard-profile.png', caption: 'Dashboard profile page' },
    { step: 8, file: '14-dashboard-program.png', caption: 'Dashboard program page' },
  ],
  'TC-AUTH-org-admin-can-complete-admin-portal-login': [
    { step: 1, file: '15-admin-overview.png', caption: 'Admin portal loaded after login' },
  ],
  'TC-ADMIN-admin-review-lifecycle-changes-application-status-and-writes-audit': [
    { step: 1, file: '16-admin-applications.png', caption: 'Admin applications list' },
    { step: 2, file: '17-admin-application-detail.png', caption: 'Admin application detail' },
  ],
  'TC-PROGRAMS-program-lifecycle-publishes-and-archives-applicant-visible-programs': [
    { step: 1, file: '18-admin-programs.png', caption: 'Admin programs list' },
    { step: 2, file: '19-admin-program-detail.png', caption: 'Admin program detail' },
  ],
  'TC-ADMIN-admin-content-path-exposes-ordered-markdown-and-youtube-resources-for-a-weekly-task': [
    { step: 1, file: '20-admin-program-content.png', caption: 'Admin program content management' },
  ],
  'TC-MISSIONS-mission-lifecycle-publishes-and-archives-applicant-visible-missions': [
    { step: 1, file: '21-admin-missions.png', caption: 'Admin missions list' },
    { step: 2, file: '22-admin-mission-detail.png', caption: 'Admin mission detail' },
  ],
  'TC-OPS-org-admin-can-complete-ops-console-login': [
    { step: 1, file: '26-ops-console.png', caption: 'Ops Console loaded after login' },
  ],
};

// ── Journey groupings: logical user journeys with ordered steps ──────────────
// Each journey groups screenshots by the real user flow, preserving execution order.
// Steps within a journey map to TC IDs where a logical relationship exists.
type JourneyStep = { step: number; file: string; caption: string; tcId?: string };
type Journey = { name: string; description: string; steps: JourneyStep[] };

const journeys: Journey[] = [
  {
    name: 'Authentication & Login',
    description: 'Applicant and admin portal authentication via Keycloak OIDC',
    steps: [
      { step: 1, file: '01-applicant-home.png', caption: 'Applicant portal home page (unauthenticated)' },
      { step: 2, file: '02-applicant-login.png', caption: 'Applicant login page', tcId: 'TC-AUTH-applicant-can-complete-applicant-portal-login' },
      { step: 3, file: '03-keycloak-signin.png', caption: 'Keycloak authentication form', tcId: 'TC-AUTH-applicant-can-complete-applicant-portal-login' },
      { step: 4, file: '03b-keycloak-register.png', caption: 'Keycloak self-registration form (new applicant signup)' },
      { step: 5, file: '15-admin-overview.png', caption: 'Admin portal loaded after Org Admin login', tcId: 'TC-AUTH-org-admin-can-complete-admin-portal-login' },
      { step: 6, file: '26-ops-console.png', caption: 'Ops Console loaded after Org Admin login', tcId: 'TC-OPS-org-admin-can-complete-ops-console-login' },
    ],
  },
  {
    name: 'Application & Onboarding',
    description: 'Applicant applies to a program and tracks application status',
    steps: [
      { step: 1, file: '04-applicant-apply.png', caption: 'Applicant apply form (program application)' },
      { step: 2, file: '05-applicant-application-status.png', caption: 'Applicant application status page (submitted)' },
    ],
  },
  {
    name: 'Applicant Dashboard',
    description: 'Accepted applicant dashboard navigation across all pages',
    steps: [
      { step: 1, file: '06-dashboard-overview.png', caption: 'Dashboard overview', tcId: 'TC-AUTH-accepted-applicant-can-reach-dashboard' },
      { step: 2, file: '07-dashboard-missions.png', caption: 'Dashboard missions list', tcId: 'TC-DASHBOARD-accepted-applicant-dashboard-pages-load' },
      { step: 3, file: '08-dashboard-mission-detail.png', caption: 'Dashboard mission detail view' },
      { step: 4, file: '09-dashboard-tasks.png', caption: 'Dashboard tasks page', tcId: 'TC-DASHBOARD-accepted-applicant-dashboard-pages-load' },
      { step: 5, file: '10-dashboard-resources.png', caption: 'Dashboard resources page', tcId: 'TC-DASHBOARD-accepted-applicant-dashboard-pages-load' },
      { step: 6, file: '11-dashboard-calendar.png', caption: 'Dashboard calendar page', tcId: 'TC-DASHBOARD-accepted-applicant-dashboard-pages-load' },
      { step: 7, file: '12-dashboard-notifications.png', caption: 'Dashboard notifications page', tcId: 'TC-DASHBOARD-accepted-applicant-dashboard-pages-load' },
      { step: 8, file: '13-dashboard-profile.png', caption: 'Dashboard profile page', tcId: 'TC-DASHBOARD-accepted-applicant-dashboard-pages-load' },
      { step: 9, file: '14-dashboard-program.png', caption: 'Dashboard program page', tcId: 'TC-DASHBOARD-accepted-applicant-dashboard-pages-load' },
    ],
  },
  {
    name: 'Applicant Journal & Mission Workspace',
    description: 'Engineering journal entries and mission workspace for accepted applicants',
    steps: [
      { step: 1, file: '28-applicant-journal-grouped.png', caption: 'Journal entries grouped by mission' },
      { step: 2, file: '29-applicant-journal-expanded.png', caption: 'Journal entries expanded with entry rows' },
      { step: 3, file: '31-applicant-journal-new.png', caption: 'New journal entry form' },
      { step: 4, file: '32-applicant-mission-workspace.png', caption: 'Mission workspace view' },
    ],
  },
  {
    name: 'Admin Applications & Review',
    description: 'Admin application review lifecycle and submission review history',
    steps: [
      { step: 1, file: '16-admin-applications.png', caption: 'Admin applications list', tcId: 'TC-ADMIN-admin-review-lifecycle-changes-application-status-and-writes-audit' },
      { step: 2, file: '17-admin-application-detail.png', caption: 'Admin application detail (review)', tcId: 'TC-ADMIN-admin-review-lifecycle-changes-application-status-and-writes-audit' },
      { step: 3, file: '35-admin-review-history.png', caption: 'Admin submission review history (previous attempts)' },
    ],
  },
  {
    name: 'Admin Programs & Content',
    description: 'Admin program management and content authoring',
    steps: [
      { step: 1, file: '18-admin-programs.png', caption: 'Admin programs list', tcId: 'TC-PROGRAMS-program-lifecycle-publishes-and-archives-applicant-visible-programs' },
      { step: 2, file: '19-admin-program-detail.png', caption: 'Admin program detail', tcId: 'TC-PROGRAMS-program-lifecycle-publishes-and-archives-applicant-visible-programs' },
      { step: 3, file: '20-admin-program-content.png', caption: 'Admin program content management', tcId: 'TC-ADMIN-admin-content-path-exposes-ordered-markdown-and-youtube-resources-for-a-weekly-task' },
      { step: 4, file: '27-admin-tasks.png', caption: 'Admin tasks workspace (weekly tasks)' },
      { step: 5, file: '34-admin-tasks-by-mission.png', caption: 'Admin tasks by mission (per-mission authoring)' },
    ],
  },
  {
    name: 'Admin Missions',
    description: 'Admin mission management, import, and detail views',
    steps: [
      { step: 1, file: '21-admin-missions.png', caption: 'Admin missions list', tcId: 'TC-MISSIONS-mission-lifecycle-publishes-and-archives-applicant-visible-missions' },
      { step: 2, file: '22-admin-mission-detail.png', caption: 'Admin mission detail', tcId: 'TC-MISSIONS-mission-lifecycle-publishes-and-archives-applicant-visible-missions' },
      { step: 3, file: '33-admin-mission-import.png', caption: 'Admin mission Markdown import panel' },
    ],
  },
];

const output = {
  runId,
  mapped: mapping,
  journeys,
  unmapped: [], // All screenshots are now in journeys
  generatedAt: new Date().toISOString(),
};

const outFile = join(outDir, 'screenshots-map.json');
writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
console.log(`Wrote screenshot map to ${outFile}`);
console.log(`Mapped: ${Object.keys(mapping).length} TCs, Journeys: ${journeys.length}`);
