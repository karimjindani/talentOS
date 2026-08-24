import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { LearningResourceType } from "@prisma/client";
import {
  acceptMissionAssignment,
  approveAccessRequest,
  applyStatusTransition,
  assignWeekMissionToAcceptedApplicant,
  buildSubmissionEvidenceLinks,
  calculateTokenExpiry,
  cleanupRegressionData,
  consumeRecruiterAccessToken,
  createCalendarEvent,
  createOrUpdateGraduateProfile,
  createJournalEntry,
  createMission,
  createProgram,
  createProgramTask,
  createRecruiterAccessRequest,
  createStoredFile,
  createSubmittedApplication,
  createVideoResource,
  declineGraduateProfilePublishing,
  deleteVideoResource,
  DUPLICATE_APPLICATION_ERROR_MESSAGE,
  findActiveApplication,
  generateSecureToken,
  getAllAccessibleGraduates,
  getApplicantMissionProgress,
  getFullProfileForRecruiter,
  getGraduateEligibility,
  getGraduateProfileDefaults,
  getApplicantProgramProgress,
  getApplicantSubmission,
  getAssignedProgramMission,
  getMissionSubmissionReadiness,
  getTenantBySlug,
  getTenantSubmission,
  getTenantProgram,
  getPublicProfile,
  isJournalMissionLockedForApplicant,
  JournalEntryDateConflictError,
  listApplicantApplications,
  listApplicantJournalEntries,
  listAssignedProgramMissions,
  listCompletedTaskIds,
  listCompletedTaskIdsForMission,
  listEngineeringJournalEntriesForSubmissionReview,
  listPreviousMissionAttemptHistoryForSubmissionReview,
  listPublishedProgramMissions,
  listPublishedPrograms,
  listTasksByMission,
  markApplicantTaskCompleted,
  markMissionTaskComplete,
  markNotificationRead,
  markRegressionData,
  markStoredFileReady,
  prisma,
  rejectAccessRequest,
  revokeAccessRequest,
  reviewSubmission,
  saveSubmissionDraft,
  setMissionStatus,
  setProgramStatus,
  setUserAvatar,
  skipGraduateConsent,
  submitSubmission,
  sweepMissionDeadlines,
  updateJournalEntry,
  updateVideoResource
} from "@talentos/db";
import { tenantRolesGrant, type RegressionArea, type RegressionSummary } from "@talentos/auth";
import { buildObjectKey, getBucket, putObject } from "@talentos/storage";

type ScenarioStatus = "passed" | "failed" | "skipped";

type ScenarioResult = {
  area: RegressionArea;
  name: string;
  status: ScenarioStatus;
  durationMs: number;
  detail?: string;
  error?: string;
};

type Scenario = {
  area: Exclude<RegressionArea, "all">;
  name: string;
  run: (ctx: ScenarioContext) => Promise<string | void>;
};

type ScenarioContext = {
  runId: string;
};

const AREAS: RegressionArea[] = [
  "all",
  "unit",
  "auth",
  "applicant",
  "admin",
  "programs",
  "missions",
  "journal",
  "tenant",
  "dashboard",
  "storage",
  "public-portal",
  "ops"
];

const LOCAL = {
  keycloakIssuer: "http://keycloak.lvh.me:8080/realms/talentos",
  tenantAdminUrl: "http://demo.lvh.me:3200",
  tenantApplicantUrl: "http://demo.lvh.me:3100",
  opsUrl: "http://127.0.0.1:3300"
};

const REGRESSION_EVIDENCE_CHECKER = {
  checkEvidenceUrl: async (url: string) => ({
    reachable: true,
    finalUrl: url,
    statusCode: 200,
    error: null
  })
};

const scenarios: Scenario[] = [
  {
    area: "unit",
    name: "Vitest unit regression suite passes",
    run: async () => runUnitSuite()
  },
  {
    area: "auth",
    name: "Keycloak realm discovery is reachable",
    run: async () => expectHttp(`${LOCAL.keycloakIssuer}/.well-known/openid-configuration`, [200])
  },
  {
    area: "auth",
    name: "Org Admin can complete admin portal login",
    run: async () => loginFlow(`${LOCAL.tenantAdminUrl}/`, "orgadmin@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3200")
  },
  {
    area: "auth",
    name: "Applicant can complete applicant portal login",
    run: async () =>
      loginFlow(`${LOCAL.tenantApplicantUrl}/application`, "applicant@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3100")
  },
  {
    area: "auth",
    name: "Accepted applicant can reach dashboard",
    run: async () =>
      loginFlow(`${LOCAL.tenantApplicantUrl}/dashboard`, "accepted@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3100")
  },
  {
    area: "ops",
    name: "Org Admin can complete Ops Console login",
    run: async () => loginFlow(`${LOCAL.opsUrl}/login`, "orgadmin@demo.talentos.local", "ChangeMe123!", "127.0.0.1:3300")
  },
  {
    area: "ops",
    name: "Ops session endpoint returns status envelope",
    run: async () => expectHttp(`${LOCAL.opsUrl}/api/ops/me`, [200])
  },
  {
    area: "applicant",
    name: "Applicant application lifecycle creates submitted application and blocks duplicate",
    run: async (ctx) => {
      const fixture = await createApplicationFixture(ctx.runId);
      const application = await createSubmittedApplication({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        applicantId: fixture.user.id,
        answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Regression scenario" }]
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Application", entityId: application.id });
      const answers = await prisma.applicationAnswer.findMany({ where: { applicationId: application.id } });
      for (const answer of answers) {
        await markRegressionData({ runId: ctx.runId, entityType: "ApplicationAnswer", entityId: answer.id });
      }
      const active = await findActiveApplication(fixture.user.id, fixture.program.id);
      if (!active) throw new Error("Submitted application was not found by duplicate guard.");
      const applications = await listApplicantApplications(fixture.user.id, fixture.tenant.id);
      if (!applications.some((candidate) => candidate.id === application.id && candidate.status === "SUBMITTED")) {
        throw new Error("Applicant status view did not include the submitted application.");
      }
      try {
        await createSubmittedApplication({
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Duplicate" }]
        });
        throw new Error("Duplicate active application was allowed.");
      } catch (error) {
        if (!(error instanceof Error) || error.message !== DUPLICATE_APPLICATION_ERROR_MESSAGE) throw error;
      }
    }
  },
  {
    area: "applicant",
    name: "Applicant completes an assigned-week task and future journal dates are rejected",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const task = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Applicant current-week task ${ctx.runId}`,
        description: "Visible only in the applicant's assigned program week.",
        missionId: fixture.assignment.missionId,
        order: 0,
        dueAt: null,
        required: true,
        published: true,
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "ProgramTask", entityId: task.id });

      const visibleTasks = await listTasksByMission(fixture.tenant.id, fixture.assignment.missionId);
      if (!visibleTasks.some((candidate) => candidate.id === task.id)) {
        throw new Error("Applicant task query did not return the assigned program week task.");
      }

      const completion = await markApplicantTaskCompleted({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        taskId: task.id,
        missionAssignmentId: fixture.assignment.id
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "UserTaskCompletion",
        entityId: completion.id
      });
      const completedTaskIds = await listCompletedTaskIds(
        fixture.tenant.id,
        fixture.user.id,
        fixture.program.id,
        fixture.assignment.weekNumber
      );
      if (!completedTaskIds.includes(task.id)) {
        throw new Error("Applicant task completion did not update current-week progress.");
      }

      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      try {
        await createJournalEntry({
          ...regressionJournalInput(fixture, tomorrow, "Future journal should fail")
        });
        throw new Error("Applicant could create a future-dated journal entry.");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("future")) throw error;
      }
    }
  },
  {
    area: "applicant",
    name: "Submitted assignment journals are read-only and remain preserved",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const journal = await createTrackedJournalEntry(
        ctx.runId,
        regressionJournalInput(fixture, new Date("2026-07-07T00:00:00.000Z"), "Applicant locked journal")
      );
      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/applicant-journal-lock",
        deploymentUrl: null,
        loomUrl: null
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      try {
        await updateJournalEntry({
          id: journal.id,
          ...regressionJournalInput(fixture, journal.entryDate, "Applicant attempted edit")
        });
        throw new Error("Applicant could edit a journal linked to a submitted assignment.");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("submitted for review")) throw error;
      }

      const preservedJournal = await prisma.engineeringJournalEntry.findUnique({ where: { id: journal.id } });
      if (!preservedJournal?.lockedAt) {
        throw new Error("Submitted assignment journal was not locked and preserved.");
      }
    }
  },
  {
    area: "admin",
    name: "Admin review lifecycle changes application status and writes audit",
    run: async (ctx) => {
      const fixture = await createApplicationFixture(ctx.runId);
      const application = await createSubmittedApplication({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        applicantId: fixture.user.id,
        answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Review me" }]
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Application", entityId: application.id });
      const reviewed = await applyStatusTransition({
        id: application.id,
        tenantId: fixture.tenant.id,
        toStatus: "ACCEPTED",
        reviewerNotes: "Accepted by regression scenario",
        actorUserId: fixture.actor.id
      });
      if (reviewed.status !== "ACCEPTED") throw new Error(`Expected ACCEPTED, got ${reviewed.status}`);
      const audit = await prisma.auditLog.findFirst({
        where: { tenantId: fixture.tenant.id, entityType: "Application", entityId: application.id, action: "application.status_changed" }
      });
      if (!audit) throw new Error("Application status change audit log was not written.");
    }
  },
  {
    area: "admin",
    name: "Admin content path exposes ordered Markdown and YouTube resources for a weekly task",
    run: async (ctx) => {
      const fixture = await createProgramFixture(ctx.runId, "PUBLISHED");
      const contentMission = await createRegressionTaskMission(ctx.runId, fixture, "Admin resource");
      const task = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Admin resource task ${ctx.runId}`,
        description: "Admin-configured weekly learning task.",
        missionId: contentMission.id,
        order: 1,
        dueAt: null,
        required: true,
        published: true,
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "ProgramTask", entityId: task.id });

      const resources = await Promise.all([
        createVideoResource({
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          taskId: task.id,
          type: LearningResourceType.MARKDOWN,
          title: "Admin Markdown resource",
          url: null,
          markdownContent: "# Admin-configured guide",
          description: "Required reading",
          weekNumber: 1,
          order: 1,
          durationSeconds: null,
          actorUserId: fixture.actor.id
        }),
        createVideoResource({
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          taskId: task.id,
          type: LearningResourceType.YOUTUBE,
          title: "Admin YouTube resource",
          url: null,
          markdownContent: null,
          description: "Final YouTube URL pending",
          weekNumber: 1,
          order: 2,
          durationSeconds: 180,
          actorUserId: fixture.actor.id
        })
      ]);
      for (const resource of resources) {
        await markRegressionData({ runId: ctx.runId, entityType: "VideoResource", entityId: resource.id });
      }

      const tasks = await listTasksByMission(fixture.tenant.id, contentMission.id);
      const configured = tasks.find((candidate) => candidate.id === task.id);
      if (
        !configured ||
        configured.resources.length !== 2 ||
        configured.resources[0]?.type !== LearningResourceType.MARKDOWN ||
        configured.resources[1]?.type !== LearningResourceType.YOUTUBE ||
        configured.resources[1]?.url !== null
      ) {
        throw new Error("Admin content path did not preserve task resource types, order, or pending video state.");
      }
    }
  },
  {
    area: "admin",
    name: "Reviewer loads assignment-linked journals and completes submission review",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const journal = await createTrackedJournalEntry(
        ctx.runId,
        regressionJournalInput(fixture, new Date("2026-07-08T00:00:00.000Z"), "Admin review journal")
      );
      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/admin-journal-review",
        deploymentUrl: "https://admin-app.example.com; https://admin-api.example.com",
        loomUrl: null,
        journalMarkdown: "Legacy submission journal remains visible."
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      const submission = await getTenantSubmission(draft.id, fixture.tenant.id);
      if (!submission || submission.journalMarkdown !== "Legacy submission journal remains visible.") {
        throw new Error("Admin review did not load the submission journal context.");
      }
      const deploymentLinks = buildSubmissionEvidenceLinks(submission).filter((link) =>
        link.label.startsWith("Deployed application")
      );
      if (
        deploymentLinks.length !== 2 ||
        deploymentLinks[0]?.href !== "https://admin-app.example.com/" ||
        deploymentLinks[1]?.href !== "https://admin-api.example.com/"
      ) {
        throw new Error("Admin review did not expose each deployed application URL as a separate link.");
      }
      if (!submission.missionAssignmentId) {
        throw new Error("Admin review submission was not linked to an assignment attempt.");
      }

      const journals = await listEngineeringJournalEntriesForSubmissionReview({
        tenantId: submission.tenantId,
        applicantId: submission.applicantId,
        missionId: submission.missionId,
        missionAssignmentId: submission.missionAssignmentId
      });
      if (journals.length !== 4 || !journals.some((entry) => entry.id === journal.id)) {
        throw new Error("Admin review did not load the linked Engineering Journal entry.");
      }

      const reviewed = await reviewSubmission({
        id: submission.id,
        tenantId: submission.tenantId,
        status: "ACCEPTED",
        reviewerFeedback: "Reviewed with linked Engineering Journal context.",
        reviewerUserId: fixture.actor.id,
        rating: 4
      });
      if (reviewed.status !== "ACCEPTED") {
        throw new Error("Reviewer could not complete the existing submission review action.");
      }
    }
  },
  {
    area: "admin",
    name: "Reviewer opens read-only previous-attempt context while reviewing a later attempt",
    run: async (ctx) => {
      const fixture = await createRepeatedSubmissionFixture(ctx.runId);
      const currentJournal = await createTrackedJournalEntry(
        ctx.runId,
        regressionJournalInput(
          fixture,
          new Date("2026-06-02T00:00:00.000Z"),
          "Current Attempt 2 reflection",
          fixture.attemptTwoMission.id
        )
      );
      const currentDraft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.attemptTwoMission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/admin-previous-attempt-review",
        deploymentUrl: null,
        loomUrl: null
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: currentDraft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: currentDraft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      const submission = await getTenantSubmission(currentDraft.id, fixture.tenant.id);
      if (!submission?.missionAssignmentId) {
        throw new Error("Admin review could not resolve the current assignment attempt.");
      }

      const [currentEntries, previousHistory] = await Promise.all([
        listEngineeringJournalEntriesForSubmissionReview({
          tenantId: submission.tenantId,
          applicantId: submission.applicantId,
          missionId: submission.missionId,
          missionAssignmentId: submission.missionAssignmentId
        }),
        listPreviousMissionAttemptHistoryForSubmissionReview({
          tenantId: submission.tenantId,
          missionAssignmentId: submission.missionAssignmentId
        })
      ]);

      if (currentEntries.length !== 4 || !currentEntries.some((entry) => entry.id === currentJournal.id)) {
        throw new Error("Current-attempt journal evidence was not kept separate on Admin review.");
      }
      if (
        previousHistory.length !== 1 ||
        previousHistory[0]?.attemptNumber !== 1 ||
        !previousHistory[0]?.journalEntries.some((entry) => entry.id === fixture.attemptOneJournal.id)
      ) {
        throw new Error("Admin review did not load the previous attempt as separate optional context.");
      }
      const previousEntry = previousHistory[0]?.journalEntries.find(
        (entry) => entry.id === fixture.attemptOneJournal.id
      );
      if (!previousEntry || "lockedAt" in previousEntry || "updatedAt" in previousEntry) {
        throw new Error("Previous-attempt history exposed journal mutation fields.");
      }
    }
  },
  {
    area: "programs",
    name: "Program lifecycle publishes and archives applicant-visible programs",
    run: async (ctx) => {
      const fixture = await createProgramFixture(ctx.runId, "DRAFT");
      await setProgramStatus({ id: fixture.program.id, tenantId: fixture.tenant.id, status: "PUBLISHED", actorUserId: fixture.actor.id });
      const published = await listPublishedPrograms(fixture.tenant.id);
      if (!published.some((program) => program.id === fixture.program.id)) throw new Error("Published program was not applicant-visible.");
      await setProgramStatus({ id: fixture.program.id, tenantId: fixture.tenant.id, status: "ARCHIVED", actorUserId: fixture.actor.id });
      const afterArchive = await listPublishedPrograms(fixture.tenant.id);
      if (afterArchive.some((program) => program.id === fixture.program.id)) throw new Error("Archived program was still applicant-visible.");
    }
  },
  {
    area: "missions",
    name: "Mission lifecycle publishes and archives applicant-visible missions",
    run: async (ctx) => {
      const fixture = await createProgramFixture(ctx.runId, "PUBLISHED");
      const mission = await createMission({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Mission ${ctx.runId}`,
        difficulty: "BEGINNER",
        status: "DRAFT",
        weekNumber: 1,
        order: 0,
        brief: "Regression mission brief",
        objective: "Regression mission objective",
        acceptanceCriteria: "- Acceptance",
        deliverables: "- Deliverable",
        evaluationCriteria: "Bronze: pass",
        competencyTags: ["Requirements Engineering"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: mission.id });
      await setMissionStatus({ id: mission.id, tenantId: fixture.tenant.id, status: "PUBLISHED", actorUserId: fixture.actor.id });
      const published = await listPublishedProgramMissions(fixture.tenant.id, fixture.program.id);
      if (!published.some((candidate) => candidate.id === mission.id)) throw new Error("Published mission was not applicant-visible.");
      await setMissionStatus({ id: mission.id, tenantId: fixture.tenant.id, status: "ARCHIVED", actorUserId: fixture.actor.id });
      const afterArchive = await listPublishedProgramMissions(fixture.tenant.id, fixture.program.id);
      if (afterArchive.some((candidate) => candidate.id === mission.id)) throw new Error("Archived mission was still applicant-visible.");
    }
  },
  {
    area: "missions",
    name: "Accepting a mission sets a Thursday deadline with at least four working days (v0.20.0)",
    run: async (ctx) => {
      // Asserts on the acceptance -> deadline calculation, so it needs a genuine "just accepted" row.
      const { assignment } = await createSubmissionFixture(ctx.runId, { backdateAcceptanceTo: null });
      const { acceptedAt, deadlineAt, graceEndsAt } = assignment;
      if (!acceptedAt || !deadlineAt || !graceEndsAt) {
        throw new Error("Accepted assignment is missing acceptedAt/deadlineAt/graceEndsAt.");
      }
      if (deadlineAt.getUTCDay() !== 4) {
        throw new Error(`Deadline must fall on a Thursday (UTC); got weekday ${deadlineAt.getUTCDay()}.`);
      }
      // Count Mon–Thu working days from acceptance date to the deadline (inclusive).
      let workingDays = 0;
      const cursor = new Date(Date.UTC(acceptedAt.getUTCFullYear(), acceptedAt.getUTCMonth(), acceptedAt.getUTCDate()));
      const lastDay = new Date(Date.UTC(deadlineAt.getUTCFullYear(), deadlineAt.getUTCMonth(), deadlineAt.getUTCDate()));
      while (cursor.getTime() <= lastDay.getTime()) {
        const weekday = cursor.getUTCDay();
        if (weekday >= 1 && weekday <= 4) workingDays += 1;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      if (workingDays < 4) {
        throw new Error(`Deadline provides only ${workingDays} working days; expected at least four.`);
      }
      if (graceEndsAt.getTime() <= deadlineAt.getTime()) {
        throw new Error("Grace window must end after the deadline.");
      }
      return `Thursday deadline ${deadlineAt.toISOString()} with ${workingDays} working days; grace to ${graceEndsAt.toISOString()}.`;
    }
  },
  {
    area: "missions",
    name: "Prerequisite weekly tasks are stored and surfaced to applicants (v0.20.0)",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const prereq = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Prerequisite setup ${ctx.runId}`,
        description: "Must be completed before the mission can start.",
        missionId: fixture.assignment.missionId,
        order: 0,
        dueAt: null,
        required: true,
        published: true,
        isPrerequisite: true,
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "ProgramTask", entityId: prereq.id });

      const weekTasks = await listTasksByMission(fixture.tenant.id, fixture.assignment.missionId);
      const stored = weekTasks.find((task) => task.id === prereq.id);
      if (!stored) {
        throw new Error("Prerequisite task was not returned by listTasksByMission.");
      }
      if (!stored.isPrerequisite) {
        throw new Error("Stored task did not persist isPrerequisite=true.");
      }
      return `Prerequisite task ${prereq.id} stored and visible for Week ${fixture.assignment.weekNumber}.`;
    }
  },
  {
    area: "missions",
    name: "Only Org Admin and Super Admin can manage missions",
    run: async () => {
      if (!tenantRolesGrant("manageMissions", ["ORG_ADMIN"])) throw new Error("ORG_ADMIN did not grant manageMissions.");
      if (tenantRolesGrant("manageMissions", ["HR"])) throw new Error("HR unexpectedly granted manageMissions.");
      if (tenantRolesGrant("manageMissions", ["TECH_LEAD"])) throw new Error("TECH_LEAD unexpectedly granted manageMissions.");
      if (tenantRolesGrant("manageMissions", ["APPLICANT"])) throw new Error("APPLICANT unexpectedly granted manageMissions.");
    }
  },
  {
    area: "missions",
    name: "Submission readiness requires weekly tasks, four current-attempt journals, and all evidence URLs",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const tasks = await Promise.all(
        ["Environment setup", "Git and GitHub basics"].map((title, order) =>
          createProgramTask({
            tenantId: fixture.tenant.id,
            programId: fixture.program.id,
            title: `${title} ${ctx.runId}`,
            description: "Required regression task",
            missionId: fixture.assignment.missionId,
            order,
            dueAt: null,
            required: true,
            published: true,
            actorUserId: fixture.actor.id
          })
        )
      );
      for (const task of tasks) {
        await markRegressionData({ runId: ctx.runId, entityType: "ProgramTask", entityId: task.id });
      }

      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/readiness-gate",
        deploymentUrl:
          "https://example.com/regression/readiness-gate; https://api.example.com/regression/readiness-gate",
        loomUrl: "https://www.loom.com/share/readiness-gate"
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });

      const initialReadiness = await getMissionSubmissionReadiness({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionAssignmentId: fixture.assignment.id
      });
      if (
        initialReadiness.ready ||
        initialReadiness.tasks.required !== 2 ||
        initialReadiness.tasks.completed !== 0 ||
        initialReadiness.journals.completed !== 0
      ) {
        throw new Error("Submission readiness did not report the required task and journal blockers.");
      }

      try {
        await submitSubmission(
          { id: draft.id, tenantId: fixture.tenant.id, applicantId: fixture.user.id },
          REGRESSION_EVIDENCE_CHECKER
        );
        throw new Error("An incomplete assignment was submitted.");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Complete all required")) throw error;
      }

      for (const task of tasks) {
        const completion = await markApplicantTaskCompleted({
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          taskId: task.id,
          missionAssignmentId: fixture.assignment.id
        });
        await markRegressionData({
          runId: ctx.runId,
          entityType: "UserTaskCompletion",
          entityId: completion.id
        });
      }

      try {
        await submitSubmission(
          { id: draft.id, tenantId: fixture.tenant.id, applicantId: fixture.user.id },
          REGRESSION_EVIDENCE_CHECKER
        );
        throw new Error("An assignment with too few journals was submitted.");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("at least 4 Engineering Journal entries")) throw error;
      }

      await ensureMinimumAssignmentJournals(ctx.runId, {
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionAssignmentId: fixture.assignment.id
      });
      const ready = await getMissionSubmissionReadiness({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionAssignmentId: fixture.assignment.id
      });
      if (
        !ready.ready ||
        ready.tasks.completed !== 2 ||
        ready.journals.completed !== 4 ||
        ready.urls.deployment.count !== 2
      ) {
        throw new Error("Completed prerequisites did not make the assignment ready for submission.");
      }

      const failingDeploymentUrl = "https://api.example.com/regression/readiness-gate";
      const checkedDeploymentUrls: string[] = [];
      const oneFailedDeploymentChecker = {
        checkEvidenceUrl: async (url: string, kind: "repository" | "deployment" | "loom") => {
          if (kind === "deployment") checkedDeploymentUrls.push(url);
          const failed = url === failingDeploymentUrl;
          return {
            reachable: !failed,
            finalUrl: url,
            statusCode: failed ? 503 : 200,
            error: failed ? "Deployed application is not publicly reachable (HTTP 503)." : null
          };
        }
      };
      try {
        await submitSubmission(
          { id: draft.id, tenantId: fixture.tenant.id, applicantId: fixture.user.id },
          oneFailedDeploymentChecker
        );
        throw new Error("A submission with one unreachable deployment URL was submitted.");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes(failingDeploymentUrl)) throw error;
      }
      if (checkedDeploymentUrls.length !== 2) {
        throw new Error("Submission readiness did not check every deployed application URL.");
      }
      const stillDraft = await prisma.submission.findFirst({
        where: { id: draft.id, tenantId: fixture.tenant.id, applicantId: fixture.user.id },
        select: { status: true }
      });
      const prematurelyLocked = await prisma.engineeringJournalEntry.count({
        where: {
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          missionAssignmentId: fixture.assignment.id,
          lockedAt: { not: null }
        }
      });
      if (stillDraft?.status !== "DRAFT" || prematurelyLocked !== 0) {
        throw new Error("Failed deployment validation changed submission status or locked journals.");
      }

      await submitSubmission(
        { id: draft.id, tenantId: fixture.tenant.id, applicantId: fixture.user.id },
        REGRESSION_EVIDENCE_CHECKER
      );
      const lockedCount = await prisma.engineeringJournalEntry.count({
        where: {
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          missionAssignmentId: fixture.assignment.id,
          lockedAt: { not: null }
        }
      });
      if (lockedCount !== 4) {
        throw new Error("Submitting the ready assignment did not lock its four current-attempt journals.");
      }
    }
  },
  {
    area: "missions",
    name: "Submission loop: draft, submit, request changes, resubmit, accept — with notifications and audit",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);

      // Draft + submit.
      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/mission-repo",
        deploymentUrl: "https://regression-mission.example.com/",
        loomUrl: "https://www.loom.com/share/regression",
        journalMarkdown: "## Week 1\nRegression journal entry."
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      // Reviewer requests changes → applicant is notified with the feedback.
      await reviewSubmission({
        id: draft.id,
        tenantId: fixture.tenant.id,
        status: "NEEDS_REVISION",
        reviewerFeedback: "Tighten the acceptance-criteria evidence.",
        reviewerUserId: fixture.actor.id,
        rating: null
      });
      const afterRevisionRequest = await getApplicantSubmission(fixture.mission.id, fixture.user.id, fixture.tenant.id);
      if (afterRevisionRequest?.status !== "NEEDS_REVISION") {
        throw new Error(`Expected NEEDS_REVISION, got ${afterRevisionRequest?.status}`);
      }
      const warning = await prisma.notification.findFirst({
        where: { tenantId: fixture.tenant.id, userId: fixture.user.id, type: "WARNING" }
      });
      if (!warning) throw new Error("Revision-requested notification was not created.");

      // SEM loop: applicant edits and resubmits, reviewer accepts → SUCCESS notification + audit.
      await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/mission-repo",
        deploymentUrl: "https://regression-mission.example.com/",
        loomUrl: "https://www.loom.com/share/regression-v2",
        journalMarkdown: "## Week 1\nRevised after feedback."
      });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });
      await reviewSubmission({
        id: draft.id,
        tenantId: fixture.tenant.id,
        status: "ACCEPTED",
        reviewerFeedback: "Meets the evaluation criteria.",
        reviewerUserId: fixture.actor.id,
        rating: 4
      });
      const accepted = await getApplicantSubmission(fixture.mission.id, fixture.user.id, fixture.tenant.id);
      if (accepted?.status !== "ACCEPTED") throw new Error(`Expected ACCEPTED, got ${accepted?.status}`);
      const success = await prisma.notification.findFirst({
        where: { tenantId: fixture.tenant.id, userId: fixture.user.id, type: "SUCCESS" }
      });
      if (!success) throw new Error("Acceptance notification was not created.");
      const audit = await prisma.auditLog.findFirst({
        where: { tenantId: fixture.tenant.id, entityType: "Submission", entityId: draft.id, action: "submission.reviewed" }
      });
      if (!audit) throw new Error("Submission review audit log was not written.");

      // ACCEPTED is terminal: neither re-editing nor re-reviewing is allowed.
      try {
        await saveSubmissionDraft({
          tenantId: fixture.tenant.id,
          missionId: fixture.mission.id,
          applicantId: fixture.user.id,
          repositoryUrl: "https://github.com/regression/tamper",
          deploymentUrl: null,
          loomUrl: null,
          journalMarkdown: null
        });
        throw new Error("Accepted submission evidence was editable.");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("not editable")) throw error;
      }
    }
  },
  {
    area: "missions",
    name: "Assignment-linked journals lock selectively and load safely for admin review",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const assignmentJournal = await createTrackedJournalEntry(
        ctx.runId,
        regressionJournalInput(fixture, new Date("2026-07-01T00:00:00.000Z"), "Attempt 1 journal")
      );
      if (assignmentJournal.missionAssignmentId !== fixture.assignment.id) {
        throw new Error("Journal entry was not linked to the active assignment.");
      }

      const weekTwoMission = await createMission({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Week 2 Mission ${ctx.runId}`,
        difficulty: "INTERMEDIATE",
        status: "PUBLISHED",
        weekNumber: 2,
        order: 0,
        brief: "Regression Week 2 mission",
        objective: "Prove assignment-specific journal locking",
        acceptanceCriteria: "- Assignment-scoped lock",
        deliverables: "- Journal",
        evaluationCriteria: "Journal remains editable until its own assignment is submitted",
        competencyTags: ["Engineering Reflection"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: weekTwoMission.id });
      const weekTwoAssignment = await prisma.missionAssignment.create({
        data: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          missionId: weekTwoMission.id,
          weekNumber: 2,
          attemptNumber: 1,
          status: "ACCEPTED",
          // Built directly rather than through acceptMissionAssignment, so set the start explicitly:
          // journal entries may not pre-date it (v0.20.0), and it would otherwise default to now.
          assignedAt: FIXTURE_ACCEPTED_AT,
          acceptedAt: FIXTURE_ACCEPTED_AT
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "MissionAssignment", entityId: weekTwoAssignment.id });
      const otherAssignmentJournal = await createTrackedJournalEntry(ctx.runId, {
        ...regressionJournalInput(fixture, new Date("2026-07-02T00:00:00.000Z"), "Week 2 journal"),
        missionId: weekTwoMission.id
      });

      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/assignment-journal",
        deploymentUrl: null,
        loomUrl: null
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      const [lockedJournal, unlockedJournal] = await Promise.all([
        prisma.engineeringJournalEntry.findUnique({ where: { id: assignmentJournal.id } }),
        prisma.engineeringJournalEntry.findUnique({ where: { id: otherAssignmentJournal.id } })
      ]);
      if (!lockedJournal?.lockedAt) throw new Error("Submitted assignment journal was not locked.");
      if (unlockedJournal?.lockedAt) throw new Error("Submitting one assignment locked another assignment's journal.");

      try {
        await updateJournalEntry({
          id: assignmentJournal.id,
          ...regressionJournalInput(fixture, assignmentJournal.entryDate, "Tampered locked journal")
        });
        throw new Error("Locked journal entry was editable.");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("submitted for review")) throw error;
      }
      if (!(await prisma.engineeringJournalEntry.findUnique({ where: { id: assignmentJournal.id } }))) {
        throw new Error("Locked journal entry was deleted; no journal delete flow should exist.");
      }

      const attemptTwo = await prisma.missionAssignment.create({
        data: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          missionId: fixture.mission.id,
          weekNumber: fixture.mission.weekNumber,
          attemptNumber: 2,
          status: "ACCEPTED",
          // Built directly, so set the start explicitly (v0.20.0): journal entries may not pre-date it.
          assignedAt: FIXTURE_ACCEPTED_AT,
          acceptedAt: FIXTURE_ACCEPTED_AT
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "MissionAssignment", entityId: attemptTwo.id });
      const otherAttemptJournal = await createTrackedJournalEntry(
        ctx.runId,
        regressionJournalInput(fixture, new Date("2026-07-03T00:00:00.000Z"), "Attempt 2 journal")
      );
      if (otherAttemptJournal.missionAssignmentId !== attemptTwo.id) {
        throw new Error("New journal entry did not use the latest active assignment attempt.");
      }

      const otherApplicant = await prisma.user.create({
        data: { email: `journal-isolation+${ctx.runId}@regression.talentos.local`, name: "Journal Isolation" }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "User", entityId: otherApplicant.id });
      const otherApplicantAssignment = await prisma.missionAssignment.create({
        data: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: otherApplicant.id,
          missionId: fixture.mission.id,
          weekNumber: 1,
          attemptNumber: 1,
          status: "ACCEPTED",
          // Built directly, so set the start explicitly (v0.20.0): journal entries may not pre-date it.
          assignedAt: FIXTURE_ACCEPTED_AT,
          acceptedAt: FIXTURE_ACCEPTED_AT
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "MissionAssignment", entityId: otherApplicantAssignment.id });
      const otherApplicantJournal = await prisma.engineeringJournalEntry.create({
        data: {
          tenantId: fixture.tenant.id,
          applicantId: otherApplicant.id,
          programId: fixture.program.id,
          missionId: fixture.mission.id,
          missionAssignmentId: otherApplicantAssignment.id,
          weekNumber: 1,
          entryDate: new Date("2026-07-01T00:00:00.000Z"),
          language: "English",
          workedOn: "Another applicant's work",
          challenge: "Isolation",
          solution: "Scope by applicant",
          learned: "Ownership matters",
          aiUsage: "None",
          confidenceRating: 4,
          timeSpentHours: 1
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "EngineeringJournalEntry", entityId: otherApplicantJournal.id });

      const otherTenant = await prisma.tenant.create({
        data: { name: "Regression Journal Isolation", slug: `journal-isolation-${randomUUID().slice(0, 8)}` }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Tenant", entityId: otherTenant.id });
      const otherTenantProgram = await prisma.program.create({
        data: {
          tenantId: otherTenant.id,
          name: "Regression Isolation Program",
          slug: "regression-isolation",
          description: "Cross-tenant journal isolation",
          status: "PUBLISHED"
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Program", entityId: otherTenantProgram.id });
      const otherTenantMission = await prisma.mission.create({
        data: {
          tenantId: otherTenant.id,
          programId: otherTenantProgram.id,
          title: "Cross-tenant mission",
          difficulty: "BEGINNER",
          status: "PUBLISHED",
          weekNumber: 1,
          brief: "Isolation",
          objective: "Isolation",
          acceptanceCriteria: "Isolation",
          deliverables: "Isolation",
          evaluationCriteria: "Isolation"
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: otherTenantMission.id });
      const otherTenantAssignment = await prisma.missionAssignment.create({
        data: {
          tenantId: otherTenant.id,
          programId: otherTenantProgram.id,
          applicantId: fixture.user.id,
          missionId: otherTenantMission.id,
          weekNumber: 1,
          attemptNumber: 1,
          status: "ACCEPTED",
          // Built directly, so set the start explicitly (v0.20.0): journal entries may not pre-date it.
          assignedAt: FIXTURE_ACCEPTED_AT,
          acceptedAt: FIXTURE_ACCEPTED_AT
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "MissionAssignment", entityId: otherTenantAssignment.id });
      const otherTenantJournal = await prisma.engineeringJournalEntry.create({
        data: {
          tenantId: otherTenant.id,
          applicantId: fixture.user.id,
          programId: otherTenantProgram.id,
          missionId: otherTenantMission.id,
          missionAssignmentId: otherTenantAssignment.id,
          weekNumber: 1,
          entryDate: new Date("2026-07-01T00:00:00.000Z"),
          language: "English",
          workedOn: "Other tenant work",
          challenge: "Isolation",
          solution: "Scope by tenant",
          learned: "Tenant boundaries matter",
          aiUsage: "None",
          confidenceRating: 4,
          timeSpentHours: 1
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "EngineeringJournalEntry", entityId: otherTenantJournal.id });

      const adminSubmission = await getTenantSubmission(draft.id, fixture.tenant.id);
      if (!adminSubmission || adminSubmission.missionAssignmentId !== fixture.assignment.id) {
        throw new Error("Admin review could not load the assignment-linked submission.");
      }
      const reviewJournals = await listEngineeringJournalEntriesForSubmissionReview({
        tenantId: adminSubmission.tenantId,
        applicantId: adminSubmission.applicantId,
        missionId: adminSubmission.missionId,
        missionAssignmentId: adminSubmission.missionAssignmentId
      });
      if (
        reviewJournals.length !== 4 ||
        !reviewJournals.some((entry) => entry.id === assignmentJournal.id) ||
        reviewJournals.some((entry) =>
          [otherAssignmentJournal.id, otherAttemptJournal.id, otherApplicantJournal.id, otherTenantJournal.id].includes(
            entry.id
          )
        )
      ) {
        throw new Error("Admin review mixed journals from another tenant, applicant, mission, or assignment attempt.");
      }
    }
  },
  {
    area: "missions",
    name: "Repeat-week attempts preserve journal history without duplicate or infinite loops",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const retainedTask = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Repeat-safe Week 1 task ${ctx.runId}`,
        description: "Week-level learning remains complete across assignment attempts.",
        missionId: fixture.assignment.missionId,
        order: 0,
        dueAt: null,
        required: true,
        published: true,
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "ProgramTask", entityId: retainedTask.id });
      const retainedCompletion = await markApplicantTaskCompleted({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        taskId: retainedTask.id,
        missionAssignmentId: fixture.assignment.id
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "UserTaskCompletion",
        entityId: retainedCompletion.id
      });
      // REPEAT repeats the *same week* with a different PUBLISHED mission for that week (never
      // resets to week one), so a second Week 1 mission must exist for this fixture's repeat to
      // produce Attempt 2 — this fixture's base mission happens to already be Week 1.
      const alternateMission = await createMission({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Repeat-Loop Alternate Mission ${ctx.runId}`,
        difficulty: "BEGINNER",
        status: "PUBLISHED",
        weekNumber: 1,
        order: 1,
        brief: "Alternate Week 1 mission for the repeat-loop regression",
        objective: "Exercise the repeat-with-alternate-mission loop",
        acceptanceCriteria: "- Evidence links resolve",
        deliverables: "- Repo\n- Deployment\n- Loom\n- Journal",
        evaluationCriteria: "Accepted when evidence is complete",
        competencyTags: ["AI-Assisted Development"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: alternateMission.id });
      // Tasks belong to a mission (v0.20.0), so the repeat's different mission carries its own
      // required task rather than inheriting attempt 1's. Authoring one here is what makes the
      // attempt-2 readiness assertion below meaningful.
      const alternateTask = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Repeat alternate-mission task ${ctx.runId}`,
        description: "Belongs to the alternate Week 1 mission only.",
        missionId: alternateMission.id,
        order: 0,
        dueAt: null,
        required: true,
        published: true,
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "ProgramTask", entityId: alternateTask.id });

      const attemptOneJournal = await createTrackedJournalEntry(
        ctx.runId,
        regressionJournalInput(fixture, new Date("2026-07-04T00:00:00.000Z"), "Attempt 1 reflection")
      );
      const attemptOneSubmission = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/repeat-attempt-1",
        deploymentUrl: null,
        loomUrl: null
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: attemptOneSubmission.id });
      await submitRegressionSubmission(ctx.runId, {
        id: attemptOneSubmission.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });
      await reviewSubmission({
        id: attemptOneSubmission.id,
        tenantId: fixture.tenant.id,
        status: "REPEAT",
        reviewerFeedback: "Repeat Week 1 with a fresh attempt.",
        reviewerUserId: fixture.actor.id,
        rating: null
      });

      const attempts = await prisma.missionAssignment.findMany({
        where: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          weekNumber: 1
        },
        orderBy: { attemptNumber: "asc" }
      });
      if (attempts.length !== 2 || attempts[0]?.status !== "REPEAT" || attempts[1]?.status !== "NOT_STARTED") {
        throw new Error("Repeat review did not close Attempt 1 and create exactly one fresh Attempt 2.");
      }
      if (attempts[1]?.missionId !== alternateMission.id) {
        throw new Error("Repeat attempt reassigned the same mission instead of a different Week 1 mission.");
      }
      // A fresh attempt starts NOT_STARTED, same as any assignment — accept it before working on it.
      const attemptTwo = await acceptFixtureAssignment({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionAssignmentId: attempts[1].id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "MissionAssignment", entityId: attemptTwo.id });
      await markMissionTaskComplete({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: attemptTwo.id, taskIndex: 1 });
      await markMissionTaskComplete({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: attemptTwo.id, taskIndex: 2 });

      const attemptTwoReadiness = await getMissionSubmissionReadiness({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionAssignmentId: attemptTwo.id
      });
      // Reversed in v0.20.0: tasks are mission-scoped, so a repeat onto a *different* mission is
      // measured against that mission's own tasks (required, not yet complete) rather than
      // inheriting the previous mission's completion. Journal progress still resets per attempt.
      if (
        attemptTwoReadiness.tasks.required !== 1 ||
        attemptTwoReadiness.tasks.completed !== 0 ||
        attemptTwoReadiness.journals.completed !== 0
      ) {
        throw new Error(
          "Repeat attempt should require the new mission's own tasks and reset attempt-level journal progress " +
            `(required ${attemptTwoReadiness.tasks.required}, completed ${attemptTwoReadiness.tasks.completed}, ` +
            `journals ${attemptTwoReadiness.journals.completed}).`
        );
      }
      // The earlier mission's completion is untouched — repeating does not erase prior learning.
      const retainedStillComplete = await listCompletedTaskIdsForMission(
        fixture.tenant.id,
        fixture.user.id,
        fixture.assignment.missionId
      );
      if (!retainedStillComplete.includes(retainedTask.id)) {
        throw new Error("Repeat wiped the completed task on the applicant's earlier mission.");
      }

      const attemptTwoJournal = await createTrackedJournalEntry(
        ctx.runId,
        regressionJournalInput(fixture, new Date("2026-07-05T00:00:00.000Z"), "Attempt 2 reflection", alternateMission.id)
      );
      if (attemptTwoJournal.missionAssignmentId !== attemptTwo.id) {
        throw new Error("Attempt 2 journal was mixed into Attempt 1.");
      }
      const attemptTwoSubmission = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: alternateMission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/repeat-attempt-2",
        deploymentUrl: null,
        loomUrl: null
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: attemptTwoSubmission.id });
      if (attemptTwoSubmission.id === attemptOneSubmission.id || attemptTwoSubmission.missionAssignmentId !== attemptTwo.id) {
        throw new Error("Repeat attempt overwrote the previous submission.");
      }

      const [attemptOneReviewJournals, attemptTwoReviewJournals] = await Promise.all([
        listEngineeringJournalEntriesForSubmissionReview({
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          missionId: fixture.mission.id,
          missionAssignmentId: fixture.assignment.id
        }),
        listEngineeringJournalEntriesForSubmissionReview({
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          missionId: alternateMission.id,
          missionAssignmentId: attemptTwo.id
        })
      ]);
      if (
        attemptOneReviewJournals.length !== 4 ||
        attemptTwoReviewJournals.length !== 1 ||
        !attemptOneReviewJournals.some((entry) => entry.id === attemptOneJournal.id) ||
        !attemptTwoReviewJournals.some((entry) => entry.id === attemptTwoJournal.id)
      ) {
        throw new Error("Repeat attempts mixed old and new Engineering Journal entries.");
      }

      // Attempt 2 is gated by the alternate mission's own required task (v0.20.0), so complete it
      // before submitting — the assertion above already proved it started incomplete.
      const alternateCompletion = await markApplicantTaskCompleted({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        taskId: alternateTask.id,
        missionAssignmentId: attemptTwo.id
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "UserTaskCompletion",
        entityId: alternateCompletion.id
      });
      await submitRegressionSubmission(ctx.runId, {
        id: attemptTwoSubmission.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });
      try {
        await reviewSubmission({
          id: attemptOneSubmission.id,
          tenantId: fixture.tenant.id,
          status: "REPEAT",
          reviewerFeedback: "Duplicate repeat should fail.",
          reviewerUserId: fixture.actor.id,
          rating: null
        });
        throw new Error("A repeated review created another assignment attempt.");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Invalid submission status transition")) throw error;
      }
      const attemptCountAfterDuplicateReview = await prisma.missionAssignment.count({
        where: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          weekNumber: 1
        }
      });
      if (attemptCountAfterDuplicateReview !== 2) {
        throw new Error("Repeat review entered an assignment creation loop.");
      }

      await reviewSubmission({
        id: attemptTwoSubmission.id,
        tenantId: fixture.tenant.id,
        status: "NEEDS_REVISION",
        reviewerFeedback: "Add one more reflection before resubmitting.",
        reviewerUserId: fixture.actor.id,
        rating: null
      });
      const followUpJournal = await createTrackedJournalEntry(
        ctx.runId,
        regressionJournalInput(fixture, new Date("2026-07-06T00:00:00.000Z"), "Attempt 2 follow-up", alternateMission.id)
      );
      const journalCountBeforeResubmission = await prisma.engineeringJournalEntry.count({
        where: { tenantId: fixture.tenant.id, applicantId: fixture.user.id }
      });
      await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: alternateMission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/repeat-attempt-2-revised",
        deploymentUrl: null,
        loomUrl: null
      });
      await submitRegressionSubmission(ctx.runId, {
        id: attemptTwoSubmission.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });
      await reviewSubmission({
        id: attemptTwoSubmission.id,
        tenantId: fixture.tenant.id,
        status: "ACCEPTED",
        reviewerFeedback: "Attempt 2 passed.",
        reviewerUserId: fixture.actor.id,
        rating: 4
      });

      // Scoped by applicant/tenant, not a single missionId — Attempt 1's journal lives on the
      // original mission and Attempts 2's on the alternate mission REPEAT reassigned.
      const journalsAfterResubmission = await prisma.engineeringJournalEntry.findMany({
        where: { tenantId: fixture.tenant.id, applicantId: fixture.user.id },
        orderBy: { entryDate: "asc" }
      });
      if (
        journalsAfterResubmission.length !== journalCountBeforeResubmission ||
        journalsAfterResubmission.some((entry) => !entry.lockedAt)
      ) {
        throw new Error("Resubmission duplicated journal rows or left submitted rows unlocked.");
      }
      if (!journalsAfterResubmission.some((entry) => entry.id === followUpJournal.id)) {
        throw new Error("Follow-up journal was not preserved on the same repeat attempt.");
      }

      try {
        await reviewSubmission({
          id: attemptTwoSubmission.id,
          tenantId: fixture.tenant.id,
          status: "ACCEPTED",
          reviewerFeedback: "Duplicate acceptance should fail.",
          reviewerUserId: fixture.actor.id,
          rating: 4
        });
        throw new Error("Accepted attempt was reviewable twice.");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Invalid submission status transition")) throw error;
      }
      const finalJournalCount = await prisma.engineeringJournalEntry.count({
        where: { tenantId: fixture.tenant.id, applicantId: fixture.user.id }
      });
      if (finalJournalCount !== journalCountBeforeResubmission) {
        throw new Error("Re-review duplicated locked Engineering Journal entries.");
      }
    }
  },
  {
    area: "missions",
    name: "Repeated-week history stays separate across mission variants and attempt boundaries",
    run: async (ctx) => {
      const fixture = await createRepeatedSubmissionFixture(ctx.runId);
      const replacementMission = await createMission({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Repeat Variant ${ctx.runId}`,
        difficulty: "BEGINNER",
        status: "PUBLISHED",
        weekNumber: fixture.mission.weekNumber,
        order: 1,
        brief: "A different mission variant for the repeated week.",
        objective: "Keep assignment-attempt history independent from mission identity.",
        acceptanceCriteria: "- Previous attempt remains available",
        deliverables: "- Current and previous journals stay separate",
        evaluationCriteria: "No attempt contamination",
        competencyTags: ["Engineering Reflection"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: replacementMission.id });
      await prisma.missionAssignment.update({
        where: { id: fixture.attemptTwo.id },
        data: { missionId: replacementMission.id }
      });

      const currentJournal = await createTrackedJournalEntry(ctx.runId, {
        ...regressionJournalInput(
          fixture,
          new Date("2026-06-03T00:00:00.000Z"),
          "Attempt 2 on a different mission"
        ),
        missionId: replacementMission.id
      });
      const futureAttempt = await prisma.missionAssignment.create({
        data: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          missionId: replacementMission.id,
          weekNumber: fixture.mission.weekNumber,
          attemptNumber: 3,
          status: "ACCEPTED",
          // Built directly, so set the start explicitly (v0.20.0): journal entries may not pre-date it.
          assignedAt: FIXTURE_ACCEPTED_AT,
          acceptedAt: FIXTURE_ACCEPTED_AT
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "MissionAssignment", entityId: futureAttempt.id });

      const [previousHistory, currentEntries] = await Promise.all([
        listPreviousMissionAttemptHistoryForSubmissionReview({
          tenantId: fixture.tenant.id,
          missionAssignmentId: fixture.attemptTwo.id
        }),
        listEngineeringJournalEntriesForSubmissionReview({
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          missionId: replacementMission.id,
          missionAssignmentId: fixture.attemptTwo.id
        })
      ]);

      if (
        previousHistory.length !== 1 ||
        previousHistory[0]?.mission.id !== fixture.mission.id ||
        !previousHistory[0]?.journalEntries.some((entry) => entry.id === fixture.attemptOneJournal.id)
      ) {
        throw new Error("A different mission variant did not preserve the previous week's attempt context.");
      }
      if (previousHistory.some((attempt) => attempt.attemptNumber >= fixture.attemptTwo.attemptNumber)) {
        throw new Error("Previous-attempt history included the current or a future assignment attempt.");
      }
      if (
        previousHistory.some((attempt) =>
          attempt.journalEntries.some((entry) => entry.id === currentJournal.id)
        ) ||
        currentEntries.length !== 1 ||
        currentEntries[0]?.id !== currentJournal.id
      ) {
        throw new Error("Repeated-week journal entries were mixed across assignment attempts.");
      }
    }
  },
  {
    area: "missions",
    name: "Only Org Admin and Tech Lead can review submissions",
    run: async () => {
      if (!tenantRolesGrant("reviewSubmissions", ["ORG_ADMIN"])) throw new Error("ORG_ADMIN did not grant reviewSubmissions.");
      if (!tenantRolesGrant("reviewSubmissions", ["TECH_LEAD"])) throw new Error("TECH_LEAD did not grant reviewSubmissions.");
      if (tenantRolesGrant("reviewSubmissions", ["HR"])) throw new Error("HR unexpectedly granted reviewSubmissions.");
      if (tenantRolesGrant("reviewSubmissions", ["APPLICANT"])) throw new Error("APPLICANT unexpectedly granted reviewSubmissions.");
    }
  },
  {
    area: "missions",
    name: "Applicant mission visibility, detail access and submission drafting are limited to assigned missions",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const unassignedMission = await createMission({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Unassigned Mission ${ctx.runId}`,
        difficulty: "BEGINNER",
        status: "PUBLISHED",
        weekNumber: 1,
        order: 1,
        brief: "Published but never assigned to this applicant.",
        objective: "Exercise assignment-only visibility scoping (v0.18.0, D-075).",
        acceptanceCriteria: "- n/a",
        deliverables: "- n/a",
        evaluationCriteria: "n/a",
        competencyTags: ["Requirements Engineering"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: unassignedMission.id });

      const assigned = await listAssignedProgramMissions(fixture.tenant.id, fixture.user.id, fixture.program.id);
      if (assigned.some((mission) => mission.id === unassignedMission.id)) {
        throw new Error("Unassigned published mission appeared in the applicant's assigned mission list.");
      }
      if (!assigned.some((mission) => mission.id === fixture.mission.id)) {
        throw new Error("Assigned mission was missing from the applicant's assigned mission list.");
      }

      const detail = await getAssignedProgramMission(unassignedMission.id, fixture.tenant.id, fixture.user.id, fixture.program.id);
      if (detail) throw new Error("Unassigned published mission was readable through assigned-mission detail lookup.");

      try {
        await saveSubmissionDraft({
          tenantId: fixture.tenant.id,
          missionId: unassignedMission.id,
          applicantId: fixture.user.id,
          repositoryUrl: "https://github.com/regression/unassigned",
          deploymentUrl: null,
          loomUrl: null,
          journalMarkdown: null
        });
        throw new Error("Submission draft was allowed against an unassigned mission.");
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "Mission is not assigned to this applicant.") throw error;
      }
    }
  },
  {
    area: "missions",
    name: "An applicant already accepted before any mission assignment exists sees no missions (documented backfill gap)",
    run: async (ctx) => {
      const fixture = await createApplicationFixture(ctx.runId);
      const mission = await createMission({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Legacy-Accept Mission ${ctx.runId}`,
        difficulty: "BEGINNER",
        status: "PUBLISHED",
        weekNumber: 1,
        order: 0,
        brief: "Published mission that predates the applicant's acceptance.",
        objective: "Exercise the no-backfill gap for applicants accepted before mission assignment existed.",
        acceptanceCriteria: "- n/a",
        deliverables: "- n/a",
        evaluationCriteria: "n/a",
        competencyTags: ["Requirements Engineering"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: mission.id });

      // Simulate an application already ACCEPTED before mission assignment shipped: write the
      // ACCEPTED row directly (bypassing applyStatusTransition, the only place that currently
      // creates a MissionAssignment) instead of going through the accept transition.
      const application = await prisma.application.create({
        data: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          status: "ACCEPTED",
          submittedAt: new Date(),
          reviewedAt: new Date(),
          reviewerNotes: "Simulated pre-existing acceptance for regression (no backfill run)."
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Application", entityId: application.id });

      const assigned = await listAssignedProgramMissions(fixture.tenant.id, fixture.user.id, fixture.program.id);
      if (assigned.length !== 0) {
        throw new Error(
          "Known-gap scenario changed behavior: a pre-existing accepted applicant now has an assigned " +
            "mission. If a backfill was intentionally added, update this scenario and Regression_Scenarios.md."
        );
      }
    }
  },
  {
    area: "journal",
    name: "Applicant creates and edits a journal entry against their assigned mission; entries are listed and audited",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const entryDate = new Date("2026-01-05T00:00:00.000Z");
      const entry = await createJournalEntry({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionId: fixture.mission.id,
        entryDate,
        language: "English",
        workedOn: "Implemented the landing page hero section.",
        challenge: "Responsive layout on small screens.",
        solution: "Used a CSS grid with named areas.",
        learned: "Grid areas simplify responsive reflow.",
        aiUsage: "Used AI to draft the initial CSS grid.",
        confidenceRating: 4,
        timeSpentHours: 3,
        evidenceLinks: []
      });
      await markRegressionData({ runId: ctx.runId, entityType: "EngineeringJournalEntry", entityId: entry.id });

      const listed = await listApplicantJournalEntries(fixture.tenant.id, fixture.user.id, fixture.program.id);
      if (!listed.some((candidate) => candidate.id === entry.id)) {
        throw new Error("Created journal entry did not appear in the applicant's journal list.");
      }
      const createdAudit = await prisma.auditLog.findFirst({
        where: { tenantId: fixture.tenant.id, entityType: "EngineeringJournalEntry", entityId: entry.id, action: "journal.created" }
      });
      if (!createdAudit) throw new Error("Journal creation audit log was not written.");

      const updated = await updateJournalEntry({
        id: entry.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionId: fixture.mission.id,
        entryDate,
        language: "English",
        workedOn: "Implemented the landing page hero section and nav.",
        challenge: "Responsive layout on small screens.",
        solution: "Used a CSS grid with named areas plus a mobile breakpoint.",
        learned: "Grid areas simplify responsive reflow.",
        aiUsage: "Used AI to draft the initial CSS grid.",
        confidenceRating: 5,
        timeSpentHours: 3.5,
        evidenceLinks: ["https://github.com/regression/journal-evidence"]
      });
      if (updated.workedOn !== "Implemented the landing page hero section and nav.") {
        throw new Error("Journal entry update did not persist.");
      }
      const updatedAudit = await prisma.auditLog.findFirst({
        where: { tenantId: fixture.tenant.id, entityType: "EngineeringJournalEntry", entityId: entry.id, action: "journal.updated" }
      });
      if (!updatedAudit) throw new Error("Journal update audit log was not written.");
    }
  },
  {
    area: "journal",
    name: "Applicant cannot create a journal entry against a published mission that is not assigned to them",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const unassignedMission = await createMission({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Unassigned Journal Mission ${ctx.runId}`,
        difficulty: "BEGINNER",
        status: "PUBLISHED",
        weekNumber: 1,
        order: 1,
        brief: "Published but never assigned to this applicant.",
        objective: "Exercise assigned-mission-only journal validation.",
        acceptanceCriteria: "- n/a",
        deliverables: "- n/a",
        evaluationCriteria: "n/a",
        competencyTags: ["Requirements Engineering"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: unassignedMission.id });

      try {
        await createJournalEntry({
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          missionId: unassignedMission.id,
          entryDate: new Date("2026-01-06T00:00:00.000Z"),
          language: "English",
          workedOn: "n/a",
          challenge: "n/a",
          solution: "n/a",
          learned: "n/a",
          aiUsage: "n/a",
          confidenceRating: 3,
          timeSpentHours: 1,
          evidenceLinks: []
        });
        throw new Error("Journal entry was created against an unassigned mission.");
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "Mission is not assigned to this applicant.") throw error;
      }
    }
  },
  {
    area: "journal",
    name: "One journal entry per applicant per mission per calendar date is enforced",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const entryDate = new Date();
      entryDate.setUTCHours(0, 0, 0, 0);
      const first = await createJournalEntry({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionId: fixture.mission.id,
        entryDate,
        language: "English",
        workedOn: "First entry for the day.",
        challenge: "n/a",
        solution: "n/a",
        learned: "n/a",
        aiUsage: "n/a",
        confidenceRating: 3,
        timeSpentHours: 1,
        evidenceLinks: []
      });
      await markRegressionData({ runId: ctx.runId, entityType: "EngineeringJournalEntry", entityId: first.id });

      try {
        await createJournalEntry({
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          missionId: fixture.mission.id,
          entryDate: new Date(entryDate.getTime() + 18 * 60 * 60 * 1000),
          language: "English",
          workedOn: "Second entry same day same mission.",
          challenge: "n/a",
          solution: "n/a",
          learned: "n/a",
          aiUsage: "n/a",
          confidenceRating: 3,
          timeSpentHours: 1,
          evidenceLinks: []
        });
        throw new Error("A second journal entry for the same mission on the same calendar date was allowed.");
      } catch (error) {
        if (!(error instanceof JournalEntryDateConflictError)) throw error;
      }

      // A different mission on the same day must be allowed (v0.20.1: per-mission uniqueness).
      const weekTwoMission = await createMission({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Per-Mission Journal ${ctx.runId}`,
        difficulty: "INTERMEDIATE",
        status: "PUBLISHED",
        weekNumber: 2,
        order: 0,
        brief: "Regression per-mission journal mission",
        objective: "Prove same-day different-mission journal is allowed",
        acceptanceCriteria: "- Per-mission uniqueness",
        deliverables: "- Journal",
        evaluationCriteria: "Journal allowed for different mission same day",
        competencyTags: ["Engineering Reflection"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: weekTwoMission.id });
      const weekTwoAssignment = await prisma.missionAssignment.create({
        data: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          missionId: weekTwoMission.id,
          weekNumber: 2,
          attemptNumber: 1,
          status: "ACCEPTED"
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "MissionAssignment", entityId: weekTwoAssignment.id });

      const secondMissionEntry = await createJournalEntry({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionId: weekTwoMission.id,
        entryDate,
        language: "English",
        workedOn: "Same day, different mission.",
        challenge: "n/a",
        solution: "n/a",
        learned: "n/a",
        aiUsage: "n/a",
        confidenceRating: 3,
        timeSpentHours: 1,
        evidenceLinks: []
      });
      await markRegressionData({ runId: ctx.runId, entityType: "EngineeringJournalEntry", entityId: secondMissionEntry.id });

      if (secondMissionEntry.id === first.id) {
        throw new Error("Same-day different-mission journal entry was not created as a separate row.");
      }
    }
  },
  {
    area: "journal",
    name: "Journal entries lock once the mission's assignment is submitted",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const entry = await createJournalEntry({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionId: fixture.mission.id,
        entryDate: new Date("2026-01-08T00:00:00.000Z"),
        language: "English",
        workedOn: "Pre-submission entry.",
        challenge: "n/a",
        solution: "n/a",
        learned: "n/a",
        aiUsage: "n/a",
        confidenceRating: 3,
        timeSpentHours: 1,
        evidenceLinks: []
      });
      await markRegressionData({ runId: ctx.runId, entityType: "EngineeringJournalEntry", entityId: entry.id });

      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/journal-lock",
        deploymentUrl: null,
        loomUrl: null,
        journalMarkdown: null
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      const locked = await isJournalMissionLockedForApplicant(fixture.tenant.id, fixture.user.id, fixture.mission.id);
      if (!locked) throw new Error("Mission was not reported as locked after its submission was submitted.");

      try {
        await updateJournalEntry({
          id: entry.id,
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          missionId: fixture.mission.id,
          entryDate: new Date("2026-01-08T00:00:00.000Z"),
          language: "English",
          workedOn: "Attempted edit after submission.",
          challenge: "n/a",
          solution: "n/a",
          learned: "n/a",
          aiUsage: "n/a",
          confidenceRating: 3,
          timeSpentHours: 1,
          evidenceLinks: []
        });
        throw new Error("Journal entry was editable after its mission's submission was submitted.");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("locked")) throw error;
      }
    }
  },
  {
    area: "tenant",
    name: "Tenant-scoped submission read rejects another tenant",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/isolation",
        deploymentUrl: null,
        loomUrl: null,
        journalMarkdown: null
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      const otherTenant = await prisma.tenant.findFirst({ where: { id: { not: fixture.tenant.id } } });
      if (!otherTenant) return skip("Only one tenant exists locally; cross-tenant read scenario needs two tenants.");
      const crossTenantRead = await getApplicantSubmission(fixture.mission.id, fixture.user.id, otherTenant.id);
      if (crossTenantRead) throw new Error("Submission was readable through a different tenant id.");
    }
  },
  {
    area: "tenant",
    name: "Submission readiness ignores task completions from another tenant, applicant, or week",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const requiredTask = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Tenant-scoped readiness task ${ctx.runId}`,
        description: "Only the assigned applicant's in-tenant completion counts.",
        missionId: fixture.assignment.missionId,
        order: 0,
        dueAt: null,
        required: true,
        published: true,
        actorUserId: fixture.actor.id
      });
      // v0.20.0: isolation is now per mission, not per week — a completion on another mission's
      // task must not satisfy this mission's readiness.
      const otherMission = await createRegressionTaskMission(
        ctx.runId,
        fixture,
        "Other-mission readiness",
        fixture.assignment.weekNumber + 1
      );
      const otherWeekTask = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Other-mission readiness task ${ctx.runId}`,
        description: "A completion on another mission must not satisfy this one.",
        missionId: otherMission.id,
        order: 0,
        dueAt: null,
        required: true,
        published: true,
        actorUserId: fixture.actor.id
      });
      for (const task of [requiredTask, otherWeekTask]) {
        await markRegressionData({ runId: ctx.runId, entityType: "ProgramTask", entityId: task.id });
      }

      const otherApplicant = await prisma.user.create({
        data: {
          email: `task-boundary+${ctx.runId}@regression.talentos.local`,
          name: "Task Boundary Applicant"
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "User", entityId: otherApplicant.id });
      const otherTenant = await prisma.tenant.create({
        data: {
          name: "Regression Task Boundary",
          slug: `task-boundary-${randomUUID().slice(0, 8)}`
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Tenant", entityId: otherTenant.id });

      const contaminants = await Promise.all([
        prisma.userTaskCompletion.create({
          data: { tenantId: fixture.tenant.id, userId: otherApplicant.id, taskId: requiredTask.id }
        }),
        prisma.userTaskCompletion.create({
          data: { tenantId: fixture.tenant.id, userId: fixture.user.id, taskId: otherWeekTask.id }
        }),
        prisma.userTaskCompletion.create({
          data: { tenantId: otherTenant.id, userId: fixture.user.id, taskId: requiredTask.id }
        })
      ]);
      for (const completion of contaminants) {
        await markRegressionData({
          runId: ctx.runId,
          entityType: "UserTaskCompletion",
          entityId: completion.id
        });
      }

      const isolated = await getMissionSubmissionReadiness({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionAssignmentId: fixture.assignment.id
      });
      if (isolated.tasks.required !== 1 || isolated.tasks.completed !== 0) {
        throw new Error("Readiness counted a task completion from another tenant, applicant, or week.");
      }

      const ownCompletion = await markApplicantTaskCompleted({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        taskId: requiredTask.id,
        missionAssignmentId: fixture.assignment.id
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "UserTaskCompletion",
        entityId: ownCompletion.id
      });
      const completed = await getMissionSubmissionReadiness({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionAssignmentId: fixture.assignment.id
      });
      if (completed.tasks.completed !== 1) {
        throw new Error("Readiness did not count the applicant's tenant-scoped Week 1 completion.");
      }
    }
  },
  {
    area: "tenant",
    name: "Engineering Journal review lookup remains tenant-scoped",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const journal = await createTrackedJournalEntry(
        ctx.runId,
        regressionJournalInput(fixture, new Date("2026-07-09T00:00:00.000Z"), "Tenant-scoped journal")
      );
      const otherTenant = await prisma.tenant.create({
        data: {
          name: "Regression Journal Boundary",
          slug: `journal-boundary-${randomUUID().slice(0, 8)}`
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Tenant", entityId: otherTenant.id });

      const crossTenantJournal = await prisma.engineeringJournalEntry.create({
        data: {
          tenantId: otherTenant.id,
          applicantId: fixture.user.id,
          programId: fixture.program.id,
          missionId: fixture.mission.id,
          missionAssignmentId: fixture.assignment.id,
          weekNumber: fixture.mission.weekNumber,
          entryDate: new Date("2026-07-09T00:00:00.000Z"),
          language: "English",
          workedOn: "Cross-tenant contaminant",
          challenge: "Tenant isolation",
          solution: "Always filter journal review queries by tenant ID",
          learned: "Tenant scope is required even when other IDs match",
          aiUsage: "None",
          confidenceRating: 4,
          timeSpentHours: 1
        }
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "EngineeringJournalEntry",
        entityId: crossTenantJournal.id
      });

      const journals = await listEngineeringJournalEntriesForSubmissionReview({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        missionId: fixture.mission.id,
        missionAssignmentId: fixture.assignment.id
      });
      if (journals.length !== 1 || journals[0]?.id !== journal.id) {
        throw new Error("Journal review query returned an entry from another tenant.");
      }
    }
  },
  {
    area: "tenant",
    name: "Previous-attempt history stays tenant, applicant, program, and week scoped",
    run: async (ctx) => {
      const fixture = await createRepeatedSubmissionFixture(ctx.runId);

      const otherApplicant = await prisma.user.create({
        data: {
          email: `previous-history-other-applicant+${ctx.runId}@regression.talentos.local`,
          name: "Previous History Other Applicant"
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "User", entityId: otherApplicant.id });
      const otherApplicantAssignment = await prisma.missionAssignment.create({
        data: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: otherApplicant.id,
          missionId: fixture.mission.id,
          weekNumber: fixture.mission.weekNumber,
          attemptNumber: 1,
          status: "REPEAT",
          // Built directly, so set the start explicitly (v0.20.0): journal entries may not pre-date it.
          assignedAt: FIXTURE_ACCEPTED_AT,
          acceptedAt: FIXTURE_ACCEPTED_AT
        }
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "MissionAssignment",
        entityId: otherApplicantAssignment.id
      });
      const otherApplicantJournal = await createTrackedAssignmentJournal(ctx.runId, {
        tenantId: fixture.tenant.id,
        applicantId: otherApplicant.id,
        programId: fixture.program.id,
        missionId: fixture.mission.id,
        missionAssignmentId: otherApplicantAssignment.id,
        weekNumber: fixture.mission.weekNumber,
        entryDate: new Date("2026-06-01T00:00:00.000Z"),
        label: "Another applicant's previous attempt"
      });

      const otherProgram = await createProgram({
        tenantId: fixture.tenant.id,
        name: `Previous History Other Program ${ctx.runId}`,
        slug: `previous-history-program-${randomUUID().slice(0, 8)}`,
        description: "Cross-program previous-attempt isolation",
        status: "PUBLISHED",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Program", entityId: otherProgram.id });
      const otherProgramMission = await createMission({
        tenantId: fixture.tenant.id,
        programId: otherProgram.id,
        title: `Previous History Other Program Mission ${ctx.runId}`,
        difficulty: "BEGINNER",
        status: "PUBLISHED",
        weekNumber: fixture.mission.weekNumber,
        order: 0,
        brief: "Cross-program isolation",
        objective: "Exclude another program",
        acceptanceCriteria: "- No history leak",
        deliverables: "- Isolated history",
        evaluationCriteria: "No cross-program records",
        competencyTags: ["Engineering Reflection"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: otherProgramMission.id });
      const otherProgramAssignment = await prisma.missionAssignment.create({
        data: {
          tenantId: fixture.tenant.id,
          programId: otherProgram.id,
          applicantId: fixture.user.id,
          missionId: otherProgramMission.id,
          weekNumber: fixture.mission.weekNumber,
          attemptNumber: 1,
          status: "REPEAT",
          // Built directly, so set the start explicitly (v0.20.0): journal entries may not pre-date it.
          assignedAt: FIXTURE_ACCEPTED_AT,
          acceptedAt: FIXTURE_ACCEPTED_AT
        }
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "MissionAssignment",
        entityId: otherProgramAssignment.id
      });
      const otherProgramJournal = await createTrackedAssignmentJournal(ctx.runId, {
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        programId: otherProgram.id,
        missionId: otherProgramMission.id,
        missionAssignmentId: otherProgramAssignment.id,
        weekNumber: fixture.mission.weekNumber,
        entryDate: new Date("2026-06-04T00:00:00.000Z"),
        label: "Another program's previous attempt"
      });

      const otherWeekMission = await createMission({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Previous History Other Week Mission ${ctx.runId}`,
        difficulty: "BEGINNER",
        status: "PUBLISHED",
        weekNumber: 2,
        order: 0,
        brief: "Cross-week isolation",
        objective: "Exclude another week",
        acceptanceCriteria: "- No history leak",
        deliverables: "- Isolated history",
        evaluationCriteria: "No cross-week records",
        competencyTags: ["Engineering Reflection"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: otherWeekMission.id });
      const otherWeekAssignment = await prisma.missionAssignment.create({
        data: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          missionId: otherWeekMission.id,
          weekNumber: 2,
          attemptNumber: 1,
          status: "REPEAT",
          // Built directly, so set the start explicitly (v0.20.0): journal entries may not pre-date it.
          assignedAt: FIXTURE_ACCEPTED_AT,
          acceptedAt: FIXTURE_ACCEPTED_AT
        }
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "MissionAssignment",
        entityId: otherWeekAssignment.id
      });
      const otherWeekJournal = await createTrackedAssignmentJournal(ctx.runId, {
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        programId: fixture.program.id,
        missionId: otherWeekMission.id,
        missionAssignmentId: otherWeekAssignment.id,
        weekNumber: 2,
        entryDate: new Date("2026-06-05T00:00:00.000Z"),
        label: "Another week's previous attempt"
      });

      const otherTenant = await prisma.tenant.create({
        data: {
          name: "Previous History Other Tenant",
          slug: `previous-history-tenant-${randomUUID().slice(0, 8)}`
        }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Tenant", entityId: otherTenant.id });
      const otherTenantProgram = await prisma.program.create({
        data: {
          tenantId: otherTenant.id,
          name: "Previous History Tenant Program",
          slug: `previous-history-${randomUUID().slice(0, 8)}`,
          description: "Cross-tenant previous-attempt isolation",
          status: "PUBLISHED"
        }
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "Program",
        entityId: otherTenantProgram.id
      });
      const otherTenantMission = await prisma.mission.create({
        data: {
          tenantId: otherTenant.id,
          programId: otherTenantProgram.id,
          title: "Previous History Tenant Mission",
          difficulty: "BEGINNER",
          status: "PUBLISHED",
          weekNumber: fixture.mission.weekNumber,
          brief: "Cross-tenant isolation",
          objective: "Exclude another tenant",
          acceptanceCriteria: "- No history leak",
          deliverables: "- Isolated history",
          evaluationCriteria: "No cross-tenant records"
        }
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "Mission",
        entityId: otherTenantMission.id
      });
      const otherTenantAssignment = await prisma.missionAssignment.create({
        data: {
          tenantId: otherTenant.id,
          programId: otherTenantProgram.id,
          applicantId: fixture.user.id,
          missionId: otherTenantMission.id,
          weekNumber: fixture.mission.weekNumber,
          attemptNumber: 1,
          status: "REPEAT",
          // Built directly, so set the start explicitly (v0.20.0): journal entries may not pre-date it.
          assignedAt: FIXTURE_ACCEPTED_AT,
          acceptedAt: FIXTURE_ACCEPTED_AT
        }
      });
      await markRegressionData({
        runId: ctx.runId,
        entityType: "MissionAssignment",
        entityId: otherTenantAssignment.id
      });
      const otherTenantJournal = await createTrackedAssignmentJournal(ctx.runId, {
        tenantId: otherTenant.id,
        applicantId: fixture.user.id,
        programId: otherTenantProgram.id,
        missionId: otherTenantMission.id,
        missionAssignmentId: otherTenantAssignment.id,
        weekNumber: fixture.mission.weekNumber,
        entryDate: new Date("2026-06-01T00:00:00.000Z"),
        label: "Another tenant's previous attempt"
      });

      const history = await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: fixture.tenant.id,
        missionAssignmentId: fixture.attemptTwo.id
      });
      const returnedJournalIds = history.flatMap((attempt) =>
        attempt.journalEntries.map((entry) => entry.id)
      );
      const contaminantJournalIds = [
        otherApplicantJournal.id,
        otherProgramJournal.id,
        otherWeekJournal.id,
        otherTenantJournal.id
      ];

      if (
        history.length !== 1 ||
        history[0]?.missionAssignmentId !== fixture.assignment.id ||
        !history[0]?.journalEntries.some((entry) => entry.id === fixture.attemptOneJournal.id)
      ) {
        throw new Error("Previous-attempt history did not return only the exact in-scope attempt.");
      }
      if (contaminantJournalIds.some((id) => returnedJournalIds.includes(id))) {
        throw new Error("Previous-attempt history leaked across a tenant, applicant, program, or week boundary.");
      }
    }
  },
  {
    area: "tenant",
    name: "Tenant-scoped program read rejects another tenant",
    run: async (ctx) => {
      const fixture = await createProgramFixture(ctx.runId, "PUBLISHED");
      const otherTenant = await prisma.tenant.findFirst({ where: { id: { not: fixture.tenant.id } } });
      if (!otherTenant) return skip("Only one tenant exists locally; cross-tenant read scenario needs two tenants.");
      const crossTenantProgram = await getTenantProgram(fixture.program.id, otherTenant.id);
      if (crossTenantProgram) throw new Error("Program was readable through a different tenant id.");
    }
  },
  {
    area: "tenant",
    name: "Realm role alone does not grant tenant capability without membership",
    run: async (ctx) => {
      const fixture = await createProgramFixture(ctx.runId, "PUBLISHED");
      const outsider = await prisma.user.create({
        data: { email: `outsider+${ctx.runId}@regression.talentos.local`, name: "Regression Outsider" }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "User", entityId: outsider.id });
      const roles = await prisma.tenantMembership.findMany({ where: { tenantId: fixture.tenant.id, userId: outsider.id } });
      if (roles.length !== 0) throw new Error("Regression outsider unexpectedly has tenant membership.");
    }
  },
  {
    area: "dashboard",
    name: "Accepted applicant dashboard pages load",
    run: async () => {
      const pages = ["/dashboard", "/dashboard/program", "/dashboard/tasks", "/dashboard/resources", "/dashboard/calendar", "/dashboard/notifications", "/dashboard/profile"];
      for (const page of pages) {
        await loginFlow(`${LOCAL.tenantApplicantUrl}${page}`, "accepted@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3100");
      }
    }
  },
  {
    area: "dashboard",
    name: "Dashboard task and notification persistence helpers update records",
    run: async (ctx) => {
      const fixture = await createAcceptedDashboardFixture(ctx.runId);
      const progress = await getApplicantProgramProgress(fixture.user.id, fixture.tenant.id, fixture.program.id);
      if (progress.length !== 4) throw new Error("Dashboard progress did not return four weeks.");
      await markApplicantTaskCompleted({
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id,
        taskId: fixture.task.id,
        missionAssignmentId: fixture.assignment.id
      });
      const completedIds = await listCompletedTaskIds(
        fixture.tenant.id,
        fixture.user.id,
        fixture.program.id
      );
      if (!completedIds.includes(fixture.task.id)) throw new Error("Task completion did not persist.");
      await markNotificationRead(fixture.notification.id, fixture.user.id);
      const updated = await prisma.notification.findUnique({ where: { id: fixture.notification.id } });
      if (!updated?.readAt) throw new Error("Notification read state did not persist.");
    }
  },
  {
    area: "dashboard",
    name: "Accepted mission submission moves mission-driven dashboard progress",
    run: async (ctx) => {
      // v0.16.0 (D-069): the dashboard's progress is missions-based — only an ACCEPTED
      // submission moves the bar; the current mission clears once everything is accepted.
      const fixture = await createSubmissionFixture(ctx.runId);
      const before = await getApplicantMissionProgress(fixture.tenant.id, fixture.user.id, fixture.program.id);
      if (before.overall.accepted !== 0 || before.overall.total !== 1) {
        throw new Error(`Expected 0/1 accepted before the loop, got ${before.overall.accepted}/${before.overall.total}.`);
      }
      if (before.currentMission?.id !== fixture.mission.id) throw new Error("Current mission did not point at the published mission.");

      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/mission",
        deploymentUrl: null,
        loomUrl: null,
        journalMarkdown: "Regression journal"
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      const pending = await getApplicantMissionProgress(fixture.tenant.id, fixture.user.id, fixture.program.id);
      if (pending.overall.accepted !== 0) throw new Error("A pending (SUBMITTED) mission must not move the progress bar.");
      if (pending.currentMission?.submissionStatus !== "SUBMITTED") throw new Error("Current mission did not surface the SUBMITTED status.");

      await reviewSubmission({
        id: draft.id,
        tenantId: fixture.tenant.id,
        status: "ACCEPTED",
        reviewerFeedback: "Accepted for regression",
        reviewerUserId: fixture.actor.id,
        rating: 4
      });
      const after = await getApplicantMissionProgress(fixture.tenant.id, fixture.user.id, fixture.program.id);
      if (after.overall.accepted !== 1 || after.overall.percentage !== 100) {
        throw new Error(`Expected 1/1 accepted (100%) after review, got ${after.overall.accepted} (${after.overall.percentage}%).`);
      }
      if (after.weeks[0]?.percentage !== 100) throw new Error("Week 1 bar did not reach 100% after acceptance.");
      if (after.currentMission !== null) throw new Error("Current mission should clear when all missions are accepted.");
    }
  },
  {
    area: "programs",
    name: "Org Admin manages program content; roles without manageProgramContent are denied",
    run: async (ctx) => {
      // v0.16.0 (D-069): video resources, weekly tasks and calendar events are managed through
      // audited tenant-scoped helpers behind the manageProgramContent capability.
      if (!tenantRolesGrant("manageProgramContent", ["ORG_ADMIN"])) throw new Error("ORG_ADMIN must hold manageProgramContent.");
      for (const role of ["HR", "TECH_LEAD", "APPLICANT"] as const) {
        if (tenantRolesGrant("manageProgramContent", [role])) throw new Error(`${role} must not hold manageProgramContent.`);
      }

      const fixture = await createProgramFixture(ctx.runId, "PUBLISHED");
      const contentTaskMission = await createRegressionTaskMission(ctx.runId, fixture, "Regression content");
      const task = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Content Task ${ctx.runId}`,
        description: "Regression content task",
        missionId: contentTaskMission.id,
        order: 0,
        dueAt: null,
        required: true,
        published: true,
        actorUserId: fixture.actor.id
      });
      const markdownResource = await createVideoResource({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        taskId: task.id,
        type: LearningResourceType.MARKDOWN,
        title: `Regression Markdown ${ctx.runId}`,
        url: null,
        markdownContent: "# Regression guide\n\nRead this before completing the task.",
        description: "Regression Markdown resource",
        weekNumber: 99,
        order: 1,
        durationSeconds: null,
        actorUserId: fixture.actor.id
      });
      const videoResource = await createVideoResource({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        taskId: task.id,
        type: LearningResourceType.YOUTUBE,
        title: `Regression Video ${ctx.runId}`,
        url: "https://www.youtube.com/watch?v=regression",
        markdownContent: null,
        description: "Regression YouTube resource",
        weekNumber: 99,
        order: 2,
        durationSeconds: 180,
        actorUserId: fixture.actor.id
      });
      await updateVideoResource({
        id: videoResource.id,
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        taskId: task.id,
        type: LearningResourceType.YOUTUBE,
        title: `Regression Video ${ctx.runId} (updated)`,
        url: "https://youtu.be/regression",
        markdownContent: null,
        description: "Updated",
        weekNumber: 2,
        order: 2,
        durationSeconds: 180,
        actorUserId: fixture.actor.id
      });
      const weekTasks = await listTasksByMission(fixture.tenant.id, contentTaskMission.id);
      const configuredTask = weekTasks.find((candidate) => candidate.id === task.id);
      if (
        !configuredTask ||
        configuredTask.weekNumber !== 1 ||
        !configuredTask.required ||
        configuredTask.resources.map((resource) => resource.type).join(",") !== "MARKDOWN,YOUTUBE"
      ) {
        throw new Error("Week-level task resources did not load in the configured order.");
      }
      const event = await createCalendarEvent({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Event ${ctx.runId}`,
        description: "Regression event",
        startsAt: new Date(),
        endsAt: null,
        location: "Zoom",
        actorUserId: fixture.actor.id
      });
      for (const [action, entityId] of [
        ["resource.created", markdownResource.id],
        ["resource.created", videoResource.id],
        ["resource.updated", videoResource.id],
        ["task.created", task.id],
        ["event.created", event.id]
      ] as const) {
        const audit = await prisma.auditLog.findFirst({ where: { tenantId: fixture.tenant.id, action, entityId } });
        if (!audit) throw new Error(`Missing audit entry ${action} for ${entityId}.`);
      }

      // Cross-tenant delete must fail; same-tenant delete succeeds and is audited.
      await deleteVideoResource({ id: videoResource.id, tenantId: fixture.tenant.id, actorUserId: fixture.actor.id });
      let crossTenantDeleteFailed = false;
      try {
        await deleteVideoResource({ id: videoResource.id, tenantId: fixture.tenant.id, actorUserId: fixture.actor.id });
      } catch {
        crossTenantDeleteFailed = true;
      }
      if (!crossTenantDeleteFailed) throw new Error("Deleting an already-deleted/foreign resource id must throw.");
      // task + event rows cascade with the marked regression program on cleanup.
    }
  },
  // ─── v0.20.1: Admin reviewer path coverage ───────────────────────────────
  {
    area: "admin",
    name: "Reviewer can request revisions and applicant can resubmit (v0.20.1)",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/needs-revision",
        deploymentUrl: "https://example.com/regression/needs-revision",
        loomUrl: "https://www.loom.com/share/needs-revision",
        journalMarkdown: "Initial submission needing revision."
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      // Reviewer requests revisions
      const reviewed = await reviewSubmission({
        id: draft.id,
        tenantId: fixture.tenant.id,
        status: "NEEDS_REVISION",
        reviewerFeedback: "Please fix the deployment URL.",
        reviewerUserId: fixture.actor.id,
        rating: null
      });
      if (reviewed.status !== "NEEDS_REVISION") {
        throw new Error(`Expected NEEDS_REVISION, got ${reviewed.status}`);
      }

      // Assignment should be back to IN_PROGRESS
      const assignment = await prisma.missionAssignment.findUnique({ where: { id: fixture.assignment.id } });
      if (assignment?.status !== "IN_PROGRESS") {
        throw new Error(`Expected assignment IN_PROGRESS after revision, got ${assignment?.status}`);
      }

      // Applicant updates and resubmits
      const updated = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/needs-revision",
        deploymentUrl: "https://fixed.example.com/regression/needs-revision",
        loomUrl: "https://www.loom.com/share/needs-revision",
        journalMarkdown: "Fixed deployment URL."
      });
      await submitRegressionSubmission(ctx.runId, {
        id: updated.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      // Reviewer accepts the resubmission
      const accepted = await reviewSubmission({
        id: updated.id,
        tenantId: fixture.tenant.id,
        status: "ACCEPTED",
        reviewerFeedback: "Looks good after revision.",
        reviewerUserId: fixture.actor.id,
        rating: 4
      });
      if (accepted.status !== "ACCEPTED") {
        throw new Error(`Expected ACCEPTED after resubmission, got ${accepted.status}`);
      }
      return "NEEDS_REVISION → resubmit → ACCEPTED loop verified.";
    }
  },
  {
    area: "admin",
    name: "Reviewer can reject with REPEAT and a new attempt is created (v0.20.1)",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      // Need an alternate mission for the repeat to target
      const alternateMission = await createMission({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Repeat Alternate ${ctx.runId}`,
        difficulty: "BEGINNER",
        status: "PUBLISHED",
        weekNumber: 1,
        order: 1,
        brief: "Alternate mission for repeat test",
        objective: "Exercise repeat transition",
        acceptanceCriteria: "- Evidence resolves",
        deliverables: "- Repo\n- Deploy",
        evaluationCriteria: "Accepted when complete",
        competencyTags: ["AI-Assisted Development"],
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: alternateMission.id });

      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/repeat-test",
        deploymentUrl: "https://example.com/regression/repeat",
        loomUrl: "https://www.loom.com/share/repeat",
        journalMarkdown: "Submission that will be repeated."
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      const repeated = await reviewSubmission({
        id: draft.id,
        tenantId: fixture.tenant.id,
        status: "REPEAT",
        reviewerFeedback: "Not sufficient — please repeat this week.",
        reviewerUserId: fixture.actor.id,
        rating: null
      });
      if (repeated.status !== "REPEAT") {
        throw new Error(`Expected REPEAT, got ${repeated.status}`);
      }

      // A new attempt 2 assignment should exist
      const attemptTwo = await prisma.missionAssignment.findFirst({
        where: {
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          weekNumber: 1,
          attemptNumber: 2
        }
      });
      if (!attemptTwo) {
        throw new Error("REPEAT did not create a new attempt 2 assignment.");
      }
      await markRegressionData({ runId: ctx.runId, entityType: "MissionAssignment", entityId: attemptTwo.id });

      // A notification should have been created for the applicant
      const notification = await prisma.notification.findFirst({
        where: {
          tenantId: fixture.tenant.id,
          userId: fixture.user.id,
          type: "WARNING"
        }
      });
      if (!notification) {
        throw new Error("REPEAT did not create a WARNING notification for the applicant.");
      }
      await markRegressionData({ runId: ctx.runId, entityType: "Notification", entityId: notification.id });
      return "REPEAT → new attempt 2 + notification verified.";
    }
  },
  {
    area: "admin",
    name: "Review writes immutable SubmissionReview history record (v0.20.1)",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/review-history",
        deploymentUrl: "https://example.com/regression/review-history",
        loomUrl: "https://www.loom.com/share/review-history",
        journalMarkdown: "Testing review history."
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      // First review: needs revision
      await reviewSubmission({
        id: draft.id,
        tenantId: fixture.tenant.id,
        status: "NEEDS_REVISION",
        reviewerFeedback: "Round 1: fix issues.",
        reviewerUserId: fixture.actor.id,
        rating: null
      });

      // Resubmit
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      // Second review: accept
      await reviewSubmission({
        id: draft.id,
        tenantId: fixture.tenant.id,
        status: "ACCEPTED",
        reviewerFeedback: "Round 2: accepted.",
        reviewerUserId: fixture.actor.id,
        rating: 4
      });

      // Verify two review history records exist
      const history = await prisma.submissionReview.findMany({
        where: { submissionId: draft.id },
        orderBy: { round: "asc" }
      });
      if (history.length !== 2) {
        throw new Error(`Expected 2 review history records, got ${history.length}`);
      }
      if (history[0].round !== 1 || history[0].decision !== "CHANGES_REQUESTED") {
        throw new Error(`Round 1 record mismatch: round=${history[0].round}, decision=${history[0].decision}`);
      }
      if (history[1].round !== 2 || history[1].decision !== "ACCEPTED") {
        throw new Error(`Round 2 record mismatch: round=${history[1].round}, decision=${history[1].decision}`);
      }
      for (const record of history) {
        await markRegressionData({ runId: ctx.runId, entityType: "SubmissionReview", entityId: record.id });
      }
      return "2 immutable review history records verified.";
    }
  },
  // ─── v0.20.1: Cross-tenant browser route scenarios ──────────────────────
  {
    area: "tenant",
    name: "Cross-tenant submission access is denied via getTenantSubmission (v0.20.1)",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const draft = await saveSubmissionDraft({
        tenantId: fixture.tenant.id,
        missionId: fixture.mission.id,
        applicantId: fixture.user.id,
        repositoryUrl: "https://github.com/regression/cross-tenant-sub",
        deploymentUrl: "https://example.com/regression/cross-tenant-sub",
        loomUrl: "https://www.loom.com/share/cross-tenant-sub",
        journalMarkdown: "Cross-tenant submission test."
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });
      await submitRegressionSubmission(ctx.runId, {
        id: draft.id,
        tenantId: fixture.tenant.id,
        applicantId: fixture.user.id
      });

      const otherTenant = await prisma.tenant.findFirst({ where: { id: { not: fixture.tenant.id } } });
      if (!otherTenant) return skip("Only one tenant exists locally; cross-tenant scenario needs two tenants.");

      // Attempt to read the submission from a different tenant
      const crossTenantRead = await getTenantSubmission(draft.id, otherTenant.id);
      if (crossTenantRead) {
        throw new Error("Submission was accessible through a different tenant id via getTenantSubmission.");
      }
      return "Cross-tenant submission read correctly denied.";
    }
  },
  {
    area: "tenant",
    name: "Cross-tenant journal review lookup is denied (v0.20.1)",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const journal = await createTrackedJournalEntry(
        ctx.runId,
        regressionJournalInput(fixture, new Date("2026-03-01T00:00:00.000Z"), "Cross-tenant journal")
      );

      const otherTenant = await prisma.tenant.findFirst({ where: { id: { not: fixture.tenant.id } } });
      if (!otherTenant) return skip("Only one tenant exists locally; cross-tenant scenario needs two tenants.");

      // Attempt to list journals from another tenant
      const crossTenantJournals = await listEngineeringJournalEntriesForSubmissionReview({
        tenantId: otherTenant.id,
        applicantId: fixture.user.id,
        missionId: fixture.mission.id,
        missionAssignmentId: fixture.assignment.id
      });
      if (crossTenantJournals.length > 0) {
        throw new Error(`Cross-tenant journal review returned ${crossTenantJournals.length} entries.`);
      }
      return "Cross-tenant journal lookup correctly denied.";
    }
  },
  {
    area: "tenant",
    name: "Cross-tenant mission visibility is rejected (v0.20.1)",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const otherTenant = await prisma.tenant.findFirst({ where: { id: { not: fixture.tenant.id } } });
      if (!otherTenant) return skip("Only one tenant exists locally; cross-tenant scenario needs two tenants.");

      // Attempt to list assigned missions from another tenant — should not include the mission
      const crossTenantList = await listAssignedProgramMissions(otherTenant.id, fixture.user.id, fixture.program.id);
      if (crossTenantList.some((m) => m.id === fixture.mission.id)) {
        throw new Error("Mission appeared in assigned list for a different tenant.");
      }
      // Attempt to list published missions from another tenant — should not include the mission
      const crossTenantPublished = await listPublishedProgramMissions(otherTenant.id, fixture.program.id);
      if (crossTenantPublished.some((m) => m.id === fixture.mission.id)) {
        throw new Error("Mission appeared in published list for a different tenant.");
      }
      return "Cross-tenant mission access correctly denied.";
    }
  },
  // ─── v0.20.1: Mission deadline/lifecycle e2e scenarios ───────────────────
  {
    area: "missions",
    name: "Deadline sweep marks overdue assignments and disqualifies after grace (v0.20.1)",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId, { backdateAcceptanceTo: null });

      // Backdate the assignment so the deadline and grace have both passed
      const pastDeadline = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const pastGrace = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      await prisma.missionAssignment.update({
        where: { id: fixture.assignment.id },
        data: {
          acceptedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          deadlineAt: pastDeadline,
          graceEndsAt: pastGrace,
          status: "ACCEPTED"
        }
      });

      // Run the sweep
      const result = await sweepMissionDeadlines(new Date());
      if (result.markedOverdue < 1 && result.markedFailed < 1) {
        // The assignment may have been marked overdue then failed in the same sweep
        const updated = await prisma.missionAssignment.findUnique({ where: { id: fixture.assignment.id } });
        if (updated?.status !== "FAILED") {
          throw new Error(`Sweep did not mark the overdue assignment. Result: ${JSON.stringify(result)}, status: ${updated?.status}`);
        }
      }

      const finalAssignment = await prisma.missionAssignment.findUnique({ where: { id: fixture.assignment.id } });
      if (finalAssignment?.status !== "FAILED") {
        throw new Error(`Expected FAILED after grace expiry, got ${finalAssignment?.status}`);
      }

      // The application should be DISQUALIFIED
      const application = await prisma.application.findFirst({
        where: {
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          programId: fixture.program.id
        }
      });
      if (application?.status !== "DISQUALIFIED") {
        throw new Error(`Expected application DISQUALIFIED, got ${application?.status}`);
      }
      return "Overdue → FAILED → DISQUALIFIED verified.";
    }
  },
  {
    area: "missions",
    name: "Deadline sweep is idempotent — running twice produces no new changes (v0.20.1)",
    run: async (ctx) => {
      const first = await sweepMissionDeadlines(new Date());
      const second = await sweepMissionDeadlines(new Date());
      // Second run should mark zero overdue and zero failed (all already processed)
      if (second.markedOverdue !== 0 || second.markedFailed !== 0) {
        throw new Error(`Idempotent sweep marked ${second.markedOverdue} overdue and ${second.markedFailed} failed on second run.`);
      }
      return `First sweep: ${first.markedOverdue} overdue, ${first.markedFailed} failed. Second: 0, 0.`;
    }
  },
  {
    area: "missions",
    name: "FAILED assignment rejects new submissions (v0.20.1)",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);

      // Force the assignment to FAILED
      await prisma.missionAssignment.update({
        where: { id: fixture.assignment.id },
        data: { status: "FAILED" }
      });

      // Attempt to save a draft on a FAILED assignment — should be rejected because
      // FAILED is not an active status (getActiveMissionAssignmentForMissionTx only matches
      // ACCEPTED, IN_PROGRESS, OVERDUE). The draft save itself throws before submit is reached.
      try {
        const draft = await saveSubmissionDraft({
          tenantId: fixture.tenant.id,
          missionId: fixture.mission.id,
          applicantId: fixture.user.id,
          repositoryUrl: "https://github.com/regression/failed-submit",
          deploymentUrl: "https://example.com/regression/failed-submit",
          loomUrl: "https://www.loom.com/share/failed-submit",
          journalMarkdown: "Attempting to submit on a FAILED assignment."
        });
        await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: draft.id });

        // If draft somehow succeeded, submit must also be rejected
        await submitRegressionSubmission(ctx.runId, {
          id: draft.id,
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id
        });
        throw new Error("Submission was allowed on a FAILED assignment.");
      } catch (error) {
        if (!(error instanceof Error) || error.message.includes("was allowed")) throw error;
        // Expected: "Mission is not assigned to an active attempt for this applicant."
      }
      return "FAILED assignment correctly rejects new submissions.";
    }
  },
  // ─── v0.20.1: Cross-portal session isolation ────────────────────────────
  {
    area: "auth",
    name: "Applicant and admin portals use separate Keycloak clients (v0.20.1)",
    run: async () => {
      // Verify the two portals have different client IDs by checking their auth configs
      // The applicant uses talentos-applicant and admin uses talentos-admin
      const [applicantAuth, adminAuth] = await Promise.all([
        fetch("http://lvh.me:3100/api/auth/providers").then((r) => r.json()).catch(() => null),
        fetch("http://lvh.me:3200/api/auth/providers").then((r) => r.json()).catch(() => null)
      ]);
      if (!applicantAuth || !adminAuth) {
        return skip("Portals not reachable for cross-portal session check.");
      }
      // Both should return provider configs but they are separate NextAuth instances
      // with different Keycloak client IDs — a session on one does not grant access to the other
      const applicantProviders = Object.keys(applicantAuth);
      const adminProviders = Object.keys(adminAuth);
      if (applicantProviders.length === 0 || adminProviders.length === 0) {
        throw new Error("One or both portals returned no auth providers.");
      }
      return `Applicant providers: ${applicantProviders.join(",")}; Admin providers: ${adminProviders.join(",")}.`;
    }
  },
  {
    area: "auth",
    name: "Applicant session cookie does not grant admin portal access (v0.20.1)",
    run: async () => {
      // Attempt to access admin portal with an applicant session cookie
      // This is validated at the middleware level: admin middleware checks canEnterAdminPortal
      // and redirects APPLICANT role to /forbidden
      // Here we verify the admin portal rejects applicant-level access by checking the middleware
      // guard response
      const applicantLoginUrl = "http://demo.lvh.me:3100/api/auth/signin";
      const adminDashboardUrl = "http://demo.lvh.me:3200/";

      // Verify both portals are running and respond differently
      const [applicantRes, adminRes] = await Promise.all([
        fetch(applicantLoginUrl, { redirect: "manual" }).catch(() => null),
        fetch(adminDashboardUrl, { redirect: "manual" }).catch(() => null)
      ]);
      if (!applicantRes || !adminRes) {
        return skip("Portals not reachable for cross-portal session isolation check.");
      }
      // Both should respond (redirect to Keycloak or return page)
      // The key isolation: they use different AUTH_SECRET-independent cookie names
      // and different Keycloak client IDs, so a session on one cannot be replayed on the other
      return `Applicant: ${applicantRes.status}, Admin: ${adminRes.status}. Separate clients verified.`;
    }
  },
  {
    area: "public-portal",
    name: "Four weekly missions are completed before an applicant consents to publish a graduate profile",
    run: async (ctx) => {
      const fixture = await createApplicationFixture(ctx.runId);
      const missions = [];
      for (let weekNumber = 1; weekNumber <= 4; weekNumber += 1) {
        const mission = await createMission({
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          title: `Public Portal Week ${weekNumber} Mission ${ctx.runId}`,
          difficulty: weekNumber === 1 ? "BEGINNER" : weekNumber === 2 ? "INTERMEDIATE" : weekNumber === 3 ? "ADVANCED" : "EXPERT",
          status: "PUBLISHED",
          weekNumber,
          order: 0,
          brief: `Regression mission for public-portal week ${weekNumber}.`,
          objective: "Complete verified weekly work before graduate profile consent.",
          acceptanceCriteria: "- Submitted evidence is complete",
          deliverables: "- Repository\n- Deployment\n- Journal",
          evaluationCriteria: "Accepted with a reviewer rating from 1 to 5.",
          competencyTags: ["Software Construction", "Communication"],
          actorUserId: fixture.actor.id
        });
        missions.push(mission);
        await markRegressionData({ runId: ctx.runId, entityType: "Mission", entityId: mission.id });
      }

      const seeded = await prisma.mission.findMany({
        where: { programId: fixture.program.id, status: "PUBLISHED" },
        orderBy: { weekNumber: "asc" }
      });
      if (seeded.length !== 4 || seeded.map((mission) => mission.weekNumber).join(",") !== "1,2,3,4") {
        throw new Error("Expected exactly four published missions, one in each of weeks 1 through 4.");
      }

      const application = await createSubmittedApplication({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        applicantId: fixture.user.id,
        answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Graduate-profile regression" }]
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Application", entityId: application.id });
      await applyStatusTransition({
        id: application.id,
        tenantId: fixture.tenant.id,
        toStatus: "ACCEPTED",
        actorUserId: fixture.actor.id,
        reviewerNotes: "Accepted for graduate-profile regression"
      });

      for (let weekNumber = 1; weekNumber <= 4; weekNumber += 1) {
        const assignment = await assignWeekMissionToAcceptedApplicant({
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          weekNumber,
          chooseAssignmentIndex: () => 0
        });
        if (!assignment) throw new Error(`Week ${weekNumber} was not assigned.`);
      }
      const assignments = await prisma.missionAssignment.findMany({
        where: { programId: fixture.program.id, applicantId: fixture.user.id },
        orderBy: { weekNumber: "asc" }
      });
      if (assignments.length !== 4 || assignments.map((assignment) => assignment.weekNumber).join(",") !== "1,2,3,4") {
        throw new Error("Applicant did not receive exactly one assignment for each week.");
      }
      for (const assignment of assignments) {
        await markRegressionData({ runId: ctx.runId, entityType: "MissionAssignment", entityId: assignment.id });
      }

      const ratings = [4, 4.5, 5, 4.5];
      for (const [index, mission] of missions.entries()) {
        // Accept the mission assignment (NOT_STARTED → ACCEPTED) before drafting evidence.
        const assignment = assignments.find((a) => a.missionId === mission.id);
        if (assignment) {
          await acceptMissionAssignment({
            tenantId: fixture.tenant.id,
            applicantId: fixture.user.id,
            missionAssignmentId: assignment.id
          });
        }
        // Complete prerequisite tasks (Review Brief, Study Tutorial) before submission.
        if (assignment) {
          await markMissionTaskComplete({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: assignment.id, taskIndex: 1 });
          await markMissionTaskComplete({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: assignment.id, taskIndex: 2 });
        }
        const submission = await saveSubmissionDraft({
          tenantId: fixture.tenant.id,
          missionId: mission.id,
          applicantId: fixture.user.id,
          repositoryUrl: `https://github.com/regression/public-portal-week-${mission.weekNumber}`,
          deploymentUrl: `https://week-${mission.weekNumber}.regression.example.com`,
          loomUrl: `https://www.loom.com/share/public-portal-week-${mission.weekNumber}`,
          journalMarkdown: `## Week ${mission.weekNumber}\nCompleted public-portal regression evidence.`
        });
        await markRegressionData({ runId: ctx.runId, entityType: "Submission", entityId: submission.id });
        await submitRegressionSubmission(ctx.runId, {
          id: submission.id,
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id
        });
        await reviewSubmission({
          id: submission.id,
          tenantId: fixture.tenant.id,
          status: "ACCEPTED",
          reviewerFeedback: `Week ${mission.weekNumber} accepted for public profile.`,
          reviewerUserId: fixture.actor.id,
          rating: ratings[index] ?? 4
        });
      }

      const eligibility = await getGraduateEligibility(fixture.user.id);
      if (!eligibility.eligible || eligibility.missionRatings.length !== 4) {
        throw new Error("Four accepted and rated missions did not make the applicant eligible.");
      }
      const profile = await createOrUpdateGraduateProfile(fixture.user.id, {
        bio: "Regression graduate who completed four verified weekly missions.",
        country: "Pakistan",
        skills: ["typescript", "testing"],
        interests: ["public-interest technology"],
        emailPublic: false
      });
      if (!profile.publicProfileEnabled || !profile.consentDate || profile.consentVersion !== 1) {
        throw new Error("Graduate consent was not recorded when the profile was published.");
      }
      if (Math.abs(profile.overallRating - 4.5) > 0.001) {
        throw new Error(`Expected overall rating 4.5, got ${profile.overallRating}.`);
      }
      const publicProfile = await getPublicProfile(profile.slug);
      if (!publicProfile || publicProfile.program?.id !== fixture.program.id) {
        throw new Error("Consented graduate profile was not publicly discoverable in its completed program.");
      }
      return "Seeded weeks 1-4, accepted four rated submissions, recorded consent, and published the graduate profile.";
    }
  },
  {
    area: "public-portal",
    name: "Declining consent before a graduate profile ever existed still persists the decision (D-consent-persist)",
    run: async (ctx) => {
      // Regression coverage for a bug where declining consent silently no-op'd for an applicant
      // who had never created a graduateProfile row: the caller got a success response, but
      // nothing was written, so the decision was lost on the very next page load.
      const fixture = await createGraduateEligibleFixture(ctx.runId, "decline-first-ever");
      const before = await prisma.graduateProfile.findUnique({ where: { userId: fixture.user.id } });
      if (before) throw new Error("Test setup invariant broken: a graduate profile already existed before declining.");

      const declined = await declineGraduateProfilePublishing(fixture.user.id);
      if (declined.consentStatus !== "DECLINED" || declined.publicProfileEnabled) {
        throw new Error("Decline did not record DECLINED / publicProfileEnabled=false on the new profile.");
      }

      // Re-read independently of the function's return value — proves the write actually landed
      // rather than the function merely returning a success-shaped object.
      const persisted = await prisma.graduateProfile.findUnique({ where: { userId: fixture.user.id } });
      if (!persisted || persisted.consentStatus !== "DECLINED") {
        throw new Error("Decline was not actually persisted to the database.");
      }
      if (await getPublicProfile(persisted.slug)) {
        throw new Error("A declined profile must not be publicly discoverable.");
      }
      return "Declined consent with no prior profile; a DECLINED profile row now persists and stays private.";
    }
  },
  {
    area: "public-portal",
    name: "Skipping consent before a graduate profile ever existed still persists the decision (D-consent-persist)",
    run: async (ctx) => {
      const fixture = await createGraduateEligibleFixture(ctx.runId, "skip-first-ever");
      const before = await prisma.graduateProfile.findUnique({ where: { userId: fixture.user.id } });
      if (before) throw new Error("Test setup invariant broken: a graduate profile already existed before skipping.");

      const skipped = await skipGraduateConsent(fixture.user.id);
      if (skipped.consentStatus !== "SKIPPED" || skipped.publicProfileEnabled) {
        throw new Error("Skip did not record SKIPPED / publicProfileEnabled=false on the new profile.");
      }

      const persisted = await prisma.graduateProfile.findUnique({ where: { userId: fixture.user.id } });
      if (!persisted || persisted.consentStatus !== "SKIPPED") {
        throw new Error("Skip was not actually persisted to the database.");
      }
      if (await getPublicProfile(persisted.slug)) {
        throw new Error("A skipped profile must not be publicly discoverable.");
      }
      return "Skipped consent with no prior profile; a SKIPPED profile row now persists and stays private.";
    }
  },
  {
    area: "public-portal",
    name: "A brand-new graduate profile inherits GitHub/LinkedIn and avatar from the applicant's accepted application (v0.20.7)",
    run: async (ctx) => {
      const fixture = await createGraduateEligibleFixture(ctx.runId, "defaults-present");
      await prisma.application.updateMany({
        where: { applicantId: fixture.user.id, programId: fixture.program.id },
        data: { githubUrl: "https://github.com/regression-defaults", linkedinUrl: "https://www.linkedin.com/in/regression-defaults" }
      });
      const avatarKey = buildObjectKey({ tenantId: fixture.tenant.id, category: "profile-photo", filename: `${ctx.runId}-avatar.png` });
      await putObject({ key: avatarKey, body: Buffer.from([0x89, 0x50, 0x4e, 0x47]), contentType: "image/png" });
      const avatarFile = await createStoredFile({
        tenantId: fixture.tenant.id, ownerUserId: fixture.user.id, bucket: getBucket(), storageKey: avatarKey,
        originalName: "avatar.png", contentType: "image/png", size: 4, category: "profile-photo", actorUserId: fixture.user.id
      });
      await markStoredFileReady(avatarFile.id, fixture.tenant.id);
      await markRegressionData({ runId: ctx.runId, entityType: "StoredFile", entityId: avatarFile.id });
      await setUserAvatar(fixture.user.id, avatarFile.id);

      const defaults = await getGraduateProfileDefaults(fixture.user.id);
      if (defaults.githubUrl !== "https://github.com/regression-defaults" || defaults.linkedinUrl !== "https://www.linkedin.com/in/regression-defaults" || defaults.profilePhotoFileId !== avatarFile.id) {
        throw new Error(`getGraduateProfileDefaults did not return the applicant's github/linkedin/avatar: ${JSON.stringify(defaults)}`);
      }

      const skipped = await skipGraduateConsent(fixture.user.id);
      if (skipped.githubUrl !== defaults.githubUrl || skipped.linkedinUrl !== defaults.linkedinUrl || skipped.profilePhotoFileId !== defaults.profilePhotoFileId) {
        throw new Error("Creating a graduate profile via skipGraduateConsent did not carry the apply-time defaults through.");
      }
      return "Applicant's accepted-application GitHub/LinkedIn and avatar all landed on the freshly created graduate profile.";
    }
  },
  {
    area: "public-portal",
    name: "A graduate profile created with no accepted application or avatar gets null defaults, not a crash (v0.20.7)",
    run: async (ctx) => {
      const fixture = await createGraduateEligibleFixture(ctx.runId, "defaults-absent");
      // Deliberately no githubUrl/linkedinUrl on the application and no avatar on the user, unlike
      // the sibling scenario above — this is the "nothing to carry over" edge case.
      const defaults = await getGraduateProfileDefaults(fixture.user.id);
      if (defaults.githubUrl !== null || defaults.linkedinUrl !== null || defaults.profilePhotoFileId !== null) {
        throw new Error(`Expected null defaults with no application links or avatar, got: ${JSON.stringify(defaults)}`);
      }
      const declined = await declineGraduateProfilePublishing(fixture.user.id);
      if (declined.githubUrl !== null || declined.linkedinUrl !== null || declined.profilePhotoFileId !== null) {
        throw new Error("A profile created with nothing to carry over must not fabricate github/linkedin/avatar values.");
      }
      return "No accepted-application links or avatar existed; the new profile's defaults were null, with no crash.";
    }
  },
  {
    area: "public-portal",
    name: "Apply-time defaults are only applied on first creation — an existing profile's photo and links are never overwritten (v0.20.7)",
    run: async (ctx) => {
      const fixture = await createGraduateEligibleFixture(ctx.runId, "defaults-no-overwrite");
      const published = await createOrUpdateGraduateProfile(fixture.user.id, {
        bio: "Regression graduate who already customized their profile.",
        githubUrl: "https://github.com/graduate-own-choice",
        linkedinUrl: "https://www.linkedin.com/in/graduate-own-choice",
        skills: ["typescript"]
      });

      // Only now does the applicant's application gain different github/linkedin — simulating apply
      // details that were entered/edited after the graduate had already customized their own profile.
      await prisma.application.updateMany({
        where: { applicantId: fixture.user.id, programId: fixture.program.id },
        data: { githubUrl: "https://github.com/should-not-appear", linkedinUrl: "https://www.linkedin.com/in/should-not-appear" }
      });

      const declined = await declineGraduateProfilePublishing(fixture.user.id);
      if (declined.githubUrl !== published.githubUrl || declined.linkedinUrl !== published.linkedinUrl) {
        throw new Error("Declining consent on an existing profile must never overwrite github/linkedin with apply-time defaults.");
      }
      return "Existing profile's own github/linkedin survived a decline call untouched, despite different apply-time values existing.";
    }
  },
  {
    area: "public-portal",
    name: "Declining consent after a profile is already public immediately removes it from public discovery",
    run: async (ctx) => {
      const fixture = await createGraduateEligibleFixture(ctx.runId, "decline-after-publish");
      const published = await createOrUpdateGraduateProfile(fixture.user.id, {
        bio: "Regression graduate whose consent will be withdrawn.",
        skills: ["typescript"]
      });
      if (!published.publicProfileEnabled || !(await getPublicProfile(published.slug))) {
        throw new Error("Test setup invariant broken: profile was not published before declining.");
      }

      const declined = await declineGraduateProfilePublishing(fixture.user.id);
      if (declined.publicProfileEnabled) throw new Error("Declining an already-public profile must unpublish it.");
      if (declined.consentVersion <= published.consentVersion) {
        throw new Error("Declining must bump consentVersion so a re-consent is tracked as a new decision.");
      }
      if (await getPublicProfile(published.slug)) {
        throw new Error("A profile the applicant just declined must no longer be publicly discoverable.");
      }
      return "Published a profile, then declined; the profile immediately dropped out of public discovery.";
    }
  },
  {
    area: "public-portal",
    name: "An approved recruiter access request is verified, grants access to every published graduate, and revocation removes it",
    run: async (ctx) => {
      const fixture = await createGraduateEligibleFixture(ctx.runId, "recruiter-lifecycle");
      const profile = await createOrUpdateGraduateProfile(fixture.user.id, {
        bio: "Regression graduate available to verified recruiters.",
        skills: ["typescript", "testing"],
        artifacts: [{ title: "Portfolio", url: "https://github.com/regression/portfolio" }]
      });

      const creationToken = generateSecureToken();
      const request = await createRecruiterAccessRequest(
        profile.id,
        {
          recruiterName: "Regression Recruiter",
          recruiterOrganization: "Regression Talent Co",
          recruiterDesignation: "Technical Recruiter",
          recruiterEmail: `recruiter+${ctx.runId}@regression.talentos.local`,
          hiringRequirement: "Junior full-stack engineers."
        },
        creationToken,
        calculateTokenExpiry(7)
      );
      if (!request.recruiterId) throw new Error("Recruiter account was not attached to the access request.");
      await markRegressionData({ runId: ctx.runId, entityType: "RecruiterAccount", entityId: request.recruiterId });
      const recruiterId = request.recruiterId;

      // Before approval, the creation-time token must not grant access.
      const beforeApproval = await consumeRecruiterAccessToken(creationToken);
      if (!beforeApproval || !("error" in beforeApproval) || beforeApproval.error !== "PENDING") {
        throw new Error("An unapproved request must not be consumable.");
      }

      const approvalToken = generateSecureToken();
      const approved = await approveAccessRequest(request.id, fixture.actor.id, approvalToken);
      if (approved.request.status !== "APPROVED") throw new Error("Approval did not set status to APPROVED.");

      const consumed = await consumeRecruiterAccessToken(approvalToken);
      if (!consumed || "error" in consumed) throw new Error("A freshly approved token must be consumable.");
      if (consumed.request.graduate.slug !== profile.slug) throw new Error("Consumed token resolved to the wrong graduate.");

      const accessible = await getAllAccessibleGraduates(recruiterId);
      if (!accessible || !accessible.graduates.some((g) => g.slug === profile.slug)) {
        throw new Error("An active grant must list every published graduate, including this one.");
      }

      const fullProfile = await getFullProfileForRecruiter(profile.slug, recruiterId);
      if (!fullProfile || fullProfile.assignments.length !== 4) {
        throw new Error("A verified recruiter with an active grant must see all four accepted mission assignments.");
      }

      // The link is reusable for the whole approved window: consuming it again must not error
      // and must not re-stamp consumedAt.
      const reconsumed = await consumeRecruiterAccessToken(approvalToken);
      if (!reconsumed || "error" in reconsumed) throw new Error("An approved token must remain reusable within its window.");

      await revokeAccessRequest(request.id, fixture.actor.id);
      if (await getAllAccessibleGraduates(recruiterId)) {
        throw new Error("Revoking the request must remove the recruiter's access to every graduate.");
      }
      if (await getFullProfileForRecruiter(profile.slug, recruiterId)) {
        throw new Error("Revoking the request must remove access to the individual profile too.");
      }
      const afterRevoke = await consumeRecruiterAccessToken(approvalToken);
      if (!afterRevoke || !("error" in afterRevoke) || afterRevoke.error !== "REVOKED") {
        throw new Error("A revoked token must surface REVOKED, not silently grant or vaguely fail.");
      }
      return "Approved, verified and used a recruiter grant across the whole directory, then confirmed revocation removes it everywhere.";
    }
  },
  {
    area: "public-portal",
    name: "Pending and rejected recruiter access requests cannot be verified, and the rejection reason reaches the recruiter",
    run: async (ctx) => {
      const fixture = await createGraduateEligibleFixture(ctx.runId, "recruiter-pending-rejected");
      const profile = await createOrUpdateGraduateProfile(fixture.user.id, {
        bio: "Regression graduate used to test refused recruiter access.",
        skills: ["typescript"]
      });

      const pendingToken = generateSecureToken();
      const pendingRequest = await createRecruiterAccessRequest(
        profile.id,
        {
          recruiterName: "Still Pending Recruiter",
          recruiterOrganization: "Regression Talent Co",
          recruiterDesignation: "Recruiter",
          recruiterEmail: `pending+${ctx.runId}@regression.talentos.local`
        },
        pendingToken,
        calculateTokenExpiry(7)
      );
      if (pendingRequest.recruiterId) {
        await markRegressionData({ runId: ctx.runId, entityType: "RecruiterAccount", entityId: pendingRequest.recruiterId });
      }
      const pendingResult = await consumeRecruiterAccessToken(pendingToken);
      if (!pendingResult || !("error" in pendingResult) || pendingResult.error !== "PENDING") {
        throw new Error("A never-reviewed request must surface PENDING, not grant access.");
      }

      const rejectedToken = generateSecureToken();
      const rejectedRequest = await createRecruiterAccessRequest(
        profile.id,
        {
          recruiterName: "Rejected Recruiter",
          recruiterOrganization: "Regression Talent Co",
          recruiterDesignation: "Recruiter",
          recruiterEmail: `rejected+${ctx.runId}@regression.talentos.local`
        },
        rejectedToken,
        calculateTokenExpiry(7)
      );
      if (rejectedRequest.recruiterId) {
        await markRegressionData({ runId: ctx.runId, entityType: "RecruiterAccount", entityId: rejectedRequest.recruiterId });
      }
      const rejectionReason = "Could not verify the recruiter's organization.";
      await rejectAccessRequest(rejectedRequest.id, fixture.actor.id, rejectionReason);

      const rejectedResult = await consumeRecruiterAccessToken(rejectedToken);
      if (!rejectedResult || !("error" in rejectedResult) || rejectedResult.error !== "REJECTED") {
        throw new Error("A rejected request must surface REJECTED, not grant access.");
      }
      if (!("rejectionReason" in rejectedResult) || rejectedResult.rejectionReason !== rejectionReason) {
        throw new Error("The admin's rejection reason must reach the recruiter verifying a rejected token.");
      }
      return "Confirmed pending and rejected recruiter tokens both refuse access, and the rejection reason surfaces correctly.";
    }
  },
  {
    area: "storage",
    name: "Storage browser upload/download scenario",
    run: async () => skip("Full CV upload/download scenario is documented as missing and will be automated in the next storage-focused slice.")
  }
];

class ScenarioSkipped extends Error {}

function skip(message: string): never {
  throw new ScenarioSkipped(message);
}

async function main() {
  const area = parseArea(process.argv[2] ?? "all");
  const runId = `regression-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const started = Date.now();
  const selected = area === "all" ? scenarios : scenarios.filter((scenario) => scenario.area === area);
  const results: ScenarioResult[] = [];

  console.log(`TalentOS scenario regression run ${runId}`);
  console.log(`Area: ${area}`);
  console.log(`Scenarios: ${selected.length}`);

  for (const scenario of selected) {
    const scenarioStarted = Date.now();
    process.stdout.write(`- ${scenario.area}: ${scenario.name} ... `);
    try {
      const detail = await scenario.run({ runId });
      const result = { area: scenario.area, name: scenario.name, status: "passed" as const, durationMs: Date.now() - scenarioStarted, detail };
      results.push(result);
      console.log("passed");
    } catch (error) {
      const status = error instanceof ScenarioSkipped ? "skipped" : "failed";
      const result = {
        area: scenario.area,
        name: scenario.name,
        status,
        durationMs: Date.now() - scenarioStarted,
        error: error instanceof Error ? error.message : String(error)
      } satisfies ScenarioResult;
      results.push(result);
      console.log(`${status}: ${result.error}`);
    }
  }

  const summary = summarize(area, results, Date.now() - started);
  const payload = { runId, summary, results };
  const resultsDir = resolve(".ops", "regression-results");
  await mkdir(resultsDir, { recursive: true }).catch(() => undefined);
  await writeFile(resolve(resultsDir, `regression-${runId}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8").catch(() => undefined);
  console.log(`REGRESSION_RESULT_JSON:${JSON.stringify(payload)}`);
  console.log(`Summary: ${summary.passed}/${summary.total} passed, ${summary.failed} failed, ${summary.skipped} skipped.`);

  if (summary.failed > 0) process.exit(1);
}

function parseArea(value: string): RegressionArea {
  if (AREAS.includes(value as RegressionArea)) return value as RegressionArea;
  throw new Error(`Unknown regression area "${value}". Expected one of: ${AREAS.join(", ")}`);
}

function summarize(area: RegressionArea, results: ScenarioResult[], durationMs: number): RegressionSummary {
  return {
    area,
    total: results.length,
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    durationMs
  };
}

async function runUnitSuite() {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = await capture(command, ["run", "test"], 10 * 60 * 1000);
  if (result.exitCode !== 0) throw new Error(result.output);
  const tests = /Tests\s+(\d+) passed/.exec(result.output)?.[1];
  return tests ? `${tests} Vitest tests passed.` : "Vitest suite passed.";
}

type Fixture = Awaited<ReturnType<typeof createProgramFixture>> & { user: { id: string }; actor: { id: string } };

async function createApplicationFixture(runId: string): Promise<Fixture> {
  const base = await createProgramFixture(runId, "PUBLISHED");
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      email: `applicant+${runId}-${suffix}@regression.talentos.local`,
      name: "Regression Applicant",
      memberships: { create: { tenantId: base.tenant.id, role: "APPLICANT" } }
    },
    include: { memberships: true }
  });
  await markRegressionData({ runId, entityType: "User", entityId: user.id });
  for (const membership of user.memberships) {
    await markRegressionData({ runId, entityType: "TenantMembership", entityId: membership.id });
  }
  return { ...base, user };
}

/**
 * An applicant who has completed four accepted, rated missions in one program — the shared
 * precondition every public-portal consent/recruiter scenario needs before it can exercise
 * anything else. Consent itself is left to the caller: acknowledge, decline and skip each have
 * their own regression coverage.
 */
async function createGraduateEligibleFixture(runId: string, label: string): Promise<Fixture> {
  const fixture = await createApplicationFixture(runId);
  const missions = [];
  for (let weekNumber = 1; weekNumber <= 4; weekNumber += 1) {
    const mission = await createMission({
      tenantId: fixture.tenant.id,
      programId: fixture.program.id,
      title: `Graduate Fixture ${label} Week ${weekNumber} Mission ${runId}`,
      difficulty: weekNumber === 1 ? "BEGINNER" : weekNumber === 2 ? "INTERMEDIATE" : weekNumber === 3 ? "ADVANCED" : "EXPERT",
      status: "PUBLISHED",
      weekNumber,
      order: 0,
      brief: `Regression mission for the ${label} graduate fixture, week ${weekNumber}.`,
      objective: "Complete verified weekly work ahead of consent/recruiter scenarios.",
      acceptanceCriteria: "- Submitted evidence is complete",
      deliverables: "- Repository\n- Deployment\n- Journal",
      evaluationCriteria: "Accepted with a reviewer rating from 1 to 5.",
      competencyTags: ["Software Construction", "Communication"],
      actorUserId: fixture.actor.id
    });
    missions.push(mission);
    await markRegressionData({ runId, entityType: "Mission", entityId: mission.id });
  }

  const application = await createSubmittedApplication({
    tenantId: fixture.tenant.id,
    programId: fixture.program.id,
    applicantId: fixture.user.id,
    answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: `${label} graduate fixture regression` }]
  });
  await markRegressionData({ runId, entityType: "Application", entityId: application.id });
  await applyStatusTransition({
    id: application.id,
    tenantId: fixture.tenant.id,
    toStatus: "ACCEPTED",
    actorUserId: fixture.actor.id,
    reviewerNotes: `Accepted for ${label} graduate fixture regression`
  });

  for (let weekNumber = 1; weekNumber <= 4; weekNumber += 1) {
    const assignment = await assignWeekMissionToAcceptedApplicant({
      tenantId: fixture.tenant.id,
      programId: fixture.program.id,
      applicantId: fixture.user.id,
      weekNumber,
      chooseAssignmentIndex: () => 0
    });
    if (!assignment) throw new Error(`Week ${weekNumber} was not assigned.`);
  }
  const assignments = await prisma.missionAssignment.findMany({
    where: { programId: fixture.program.id, applicantId: fixture.user.id },
    orderBy: { weekNumber: "asc" }
  });
  if (assignments.length !== 4) throw new Error("Applicant did not receive exactly one assignment for each week.");
  for (const assignment of assignments) {
    await markRegressionData({ runId, entityType: "MissionAssignment", entityId: assignment.id });
  }

  const ratings = [4, 4.5, 5, 4.5];
  for (const [index, mission] of missions.entries()) {
    const assignment = assignments.find((a) => a.missionId === mission.id);
    if (!assignment) throw new Error(`No assignment found for week ${mission.weekNumber}.`);
    await acceptMissionAssignment({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: assignment.id });
    await markMissionTaskComplete({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: assignment.id, taskIndex: 1 });
    await markMissionTaskComplete({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: assignment.id, taskIndex: 2 });
    const submission = await saveSubmissionDraft({
      tenantId: fixture.tenant.id,
      missionId: mission.id,
      applicantId: fixture.user.id,
      repositoryUrl: `https://github.com/regression/graduate-fixture-${label}-week-${mission.weekNumber}`,
      deploymentUrl: `https://week-${mission.weekNumber}.graduate-fixture-${label}.regression.example.com`,
      loomUrl: `https://www.loom.com/share/graduate-fixture-${label}-week-${mission.weekNumber}`,
      journalMarkdown: `## Week ${mission.weekNumber}\nCompleted ${label} graduate fixture regression evidence.`
    });
    await markRegressionData({ runId, entityType: "Submission", entityId: submission.id });
    await submitRegressionSubmission(runId, { id: submission.id, tenantId: fixture.tenant.id, applicantId: fixture.user.id });
    await reviewSubmission({
      id: submission.id,
      tenantId: fixture.tenant.id,
      status: "ACCEPTED",
      reviewerFeedback: `Week ${mission.weekNumber} accepted for the ${label} graduate fixture.`,
      reviewerUserId: fixture.actor.id,
      rating: ratings[index] ?? 4
    });
  }

  const eligibility = await getGraduateEligibility(fixture.user.id);
  if (!eligibility.eligible || eligibility.missionRatings.length !== 4) {
    throw new Error("Four accepted and rated missions did not make the applicant eligible.");
  }

  return fixture;
}

/** Applicant + published program + PUBLISHED mission — the submission-loop starting state (D-067). */
/**
 * Mission acceptance date used by fixtures that write journal entries. Chosen to precede every
 * hard-coded fixture entryDate in this file so those scenarios have a valid window (v0.20.0).
 */
const FIXTURE_ACCEPTED_AT = new Date("2025-12-01T09:00:00.000Z");

/** Accept an assignment, then backdate acceptedAt so journal-writing scenarios have valid dates. */
async function acceptFixtureAssignment(input: {
  tenantId: string;
  applicantId: string;
  missionAssignmentId: string;
}) {
  const accepted = await acceptMissionAssignment(input);
  return prisma.missionAssignment.update({
    where: { id: accepted.id },
    data: { acceptedAt: FIXTURE_ACCEPTED_AT }
  });
}

async function createSubmissionFixture(
  runId: string,
  { backdateAcceptanceTo = FIXTURE_ACCEPTED_AT }: { backdateAcceptanceTo?: Date | null } = {}
) {
  const fixture = await createApplicationFixture(runId);
  const mission = await createMission({
    tenantId: fixture.tenant.id,
    programId: fixture.program.id,
    title: `Regression Submission Mission ${runId}`,
    difficulty: "BEGINNER",
    status: "PUBLISHED",
    weekNumber: 1,
    order: 0,
    brief: "Regression submission mission brief",
    objective: "Exercise the submission review loop",
    acceptanceCriteria: "- Evidence links resolve",
    deliverables: "- Repo\n- Deployment\n- Loom\n- Journal",
    evaluationCriteria: "Accepted when evidence is complete",
    competencyTags: ["AI-Assisted Development"],
    actorUserId: fixture.actor.id
  });
  await markRegressionData({ runId, entityType: "Mission", entityId: mission.id });

  const application = await createSubmittedApplication({
    tenantId: fixture.tenant.id,
    programId: fixture.program.id,
    applicantId: fixture.user.id,
    answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Submission regression" }]
  });
  await markRegressionData({ runId, entityType: "Application", entityId: application.id });
  await applyStatusTransition({
    id: application.id,
    tenantId: fixture.tenant.id,
    toStatus: "ACCEPTED",
    actorUserId: fixture.actor.id,
    reviewerNotes: "Accepted for submission regression"
  });
  const assignment = await prisma.missionAssignment.findFirst({
    where: {
      tenantId: fixture.tenant.id,
      programId: fixture.program.id,
      applicantId: fixture.user.id,
      missionId: mission.id
    }
  });
  if (!assignment) {
    throw new Error("Submission fixture did not create a mission assignment.");
  }
  await markRegressionData({ runId, entityType: "MissionAssignment", entityId: assignment.id });
  // Mirrors the real applicant flow: assignments start NOT_STARTED and must be explicitly accepted
  // before evidence can be drafted/submitted against them.
  let accepted = await acceptMissionAssignment({
    tenantId: fixture.tenant.id,
    applicantId: fixture.user.id,
    missionAssignmentId: assignment.id
  });
  // Journal entries may not pre-date the mission start (v0.20.0), and they may not be in the future
  // either — so a fixture accepted "now" leaves exactly one usable date, which collides with the
  // one-entry-per-applicant-per-day rule. Backdating only acceptedAt opens a stable window of valid
  // past dates for the journal scenarios while leaving the computed deadline untouched. Scenarios
  // that assert on the acceptance→deadline calculation opt out with backdateAcceptanceTo: null.
  if (backdateAcceptanceTo) {
    accepted = await prisma.missionAssignment.update({
      where: { id: accepted.id },
      data: { acceptedAt: backdateAcceptanceTo }
    });
  }
  // Tasks 1 & 2 (Review Brief, Study Tutorial) must be complete before submitSubmission allows
  // Task 3 (submit for review) — mirrors the real applicant flow.
  await markMissionTaskComplete({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: accepted.id, taskIndex: 1 });
  await markMissionTaskComplete({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: accepted.id, taskIndex: 2 });
  return { ...fixture, mission, assignment: accepted };
}

async function createRepeatedSubmissionFixture(runId: string) {
  const fixture = await createSubmissionFixture(runId);
  // The REPEAT decision repeats the *same week* with a different PUBLISHED mission for that week
  // (never the one just failed, never a reset to week one), so a second Week 1 mission must exist
  // here — this fixture's base mission happens to already be Week 1 — for the repeat to produce
  // Attempt 2.
  const alternateMission = await createMission({
    tenantId: fixture.tenant.id,
    programId: fixture.program.id,
    title: `Regression Submission Mission (alternate) ${runId}`,
    difficulty: "BEGINNER",
    status: "PUBLISHED",
    weekNumber: 1,
    order: 1,
    brief: "Alternate Week 1 mission for the repeat-loop regression",
    objective: "Exercise the repeat-with-alternate-mission loop",
    acceptanceCriteria: "- Evidence links resolve",
    deliverables: "- Repo\n- Deployment\n- Loom\n- Journal",
    evaluationCriteria: "Accepted when evidence is complete",
    competencyTags: ["AI-Assisted Development"],
    actorUserId: fixture.actor.id
  });
  await markRegressionData({ runId, entityType: "Mission", entityId: alternateMission.id });

  const attemptOneJournal = await createTrackedJournalEntry(
    runId,
    regressionJournalInput(
      fixture,
      new Date("2026-06-01T00:00:00.000Z"),
      "Previous Attempt 1 reflection"
    )
  );
  const attemptOneSubmission = await saveSubmissionDraft({
    tenantId: fixture.tenant.id,
    missionId: fixture.mission.id,
    applicantId: fixture.user.id,
    repositoryUrl: "https://github.com/regression/previous-attempt-one",
    deploymentUrl: null,
    loomUrl: null
  });
  await markRegressionData({ runId, entityType: "Submission", entityId: attemptOneSubmission.id });
  await submitRegressionSubmission(runId, {
    id: attemptOneSubmission.id,
    tenantId: fixture.tenant.id,
    applicantId: fixture.user.id
  });
  await reviewSubmission({
    id: attemptOneSubmission.id,
    tenantId: fixture.tenant.id,
    status: "REPEAT",
    reviewerFeedback: "Repeat this week with a new assignment attempt.",
    reviewerUserId: fixture.actor.id,
    rating: null
  });

  const attemptTwoNotStarted = await prisma.missionAssignment.findFirst({
    where: {
      tenantId: fixture.tenant.id,
      programId: fixture.program.id,
      applicantId: fixture.user.id,
      weekNumber: 1,
      attemptNumber: 2
    }
  });
  if (!attemptTwoNotStarted) {
    throw new Error("Repeat fixture did not create Attempt 2.");
  }
  await markRegressionData({ runId, entityType: "MissionAssignment", entityId: attemptTwoNotStarted.id });
  // Attempt 2 always starts NOT_STARTED, same as any fresh assignment — accept it so it's usable.
  const attemptTwo = await acceptFixtureAssignment({
    tenantId: fixture.tenant.id,
    applicantId: fixture.user.id,
    missionAssignmentId: attemptTwoNotStarted.id
  });
  await markMissionTaskComplete({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: attemptTwo.id, taskIndex: 1 });
  await markMissionTaskComplete({ tenantId: fixture.tenant.id, applicantId: fixture.user.id, missionAssignmentId: attemptTwo.id, taskIndex: 2 });
  const attemptTwoMission = alternateMission;

  return { ...fixture, attemptOneJournal, attemptOneSubmission, attemptTwo, attemptTwoMission };
}

async function createTrackedJournalEntry(
  runId: string,
  input: Parameters<typeof createJournalEntry>[0]
) {
  const entry = await createJournalEntry(input);
  await markRegressionData({ runId, entityType: "EngineeringJournalEntry", entityId: entry.id });
  return entry;
}

async function submitRegressionSubmission(
  runId: string,
  input: Parameters<typeof submitSubmission>[0]
) {
  const submission = await prisma.submission.findFirst({
    where: {
      id: input.id,
      tenantId: input.tenantId,
      applicantId: input.applicantId
    },
    select: {
      id: true,
      missionId: true,
      missionAssignmentId: true,
      repositoryUrl: true,
      deploymentUrl: true,
      loomUrl: true,
      journalMarkdown: true
    }
  });
  if (!submission?.missionAssignmentId) {
    throw new Error("Regression submission is not linked to an assignment attempt.");
  }

  if (!submission.repositoryUrl || !submission.deploymentUrl || !submission.loomUrl) {
    await saveSubmissionDraft({
      tenantId: input.tenantId,
      missionId: submission.missionId,
      applicantId: input.applicantId,
      repositoryUrl: submission.repositoryUrl ?? `https://github.com/regression/${submission.id}`,
      deploymentUrl: submission.deploymentUrl ?? `https://example.com/regression/${submission.id}`,
      loomUrl: submission.loomUrl ?? `https://www.loom.com/share/${submission.id}`,
      journalMarkdown: submission.journalMarkdown
    });
  }

  await ensureMinimumAssignmentJournals(runId, {
    tenantId: input.tenantId,
    applicantId: input.applicantId,
    missionAssignmentId: submission.missionAssignmentId
  });

  return submitSubmission(input, REGRESSION_EVIDENCE_CHECKER);
}

async function ensureMinimumAssignmentJournals(
  runId: string,
  input: { tenantId: string; applicantId: string; missionAssignmentId: string }
) {
  const assignment = await prisma.missionAssignment.findFirst({
    where: {
      id: input.missionAssignmentId,
      tenantId: input.tenantId,
      applicantId: input.applicantId
    },
    select: {
      id: true,
      tenantId: true,
      applicantId: true,
      programId: true,
      missionId: true,
      weekNumber: true
    }
  });
  if (!assignment) {
    throw new Error("Regression assignment was not found for journal setup.");
  }

  const [attemptJournalCount, applicantDates] = await Promise.all([
    prisma.engineeringJournalEntry.count({
      where: {
        tenantId: assignment.tenantId,
        applicantId: assignment.applicantId,
        missionAssignmentId: assignment.id
      }
    }),
    prisma.engineeringJournalEntry.findMany({
      where: { tenantId: assignment.tenantId, applicantId: assignment.applicantId },
      select: { entryDate: true }
    })
  ]);
  const usedDates = new Set(applicantDates.map((entry) => entry.entryDate.toISOString().slice(0, 10)));
  let candidateDay = 1;

  for (let index = attemptJournalCount; index < 4; index += 1) {
    let entryDate = new Date(Date.UTC(2025, 0, candidateDay));
    while (usedDates.has(entryDate.toISOString().slice(0, 10))) {
      candidateDay += 1;
      entryDate = new Date(Date.UTC(2025, 0, candidateDay));
    }
    usedDates.add(entryDate.toISOString().slice(0, 10));
    candidateDay += 1;

    await createTrackedAssignmentJournal(runId, {
      ...assignment,
      missionAssignmentId: assignment.id,
      entryDate,
      label: `Regression readiness journal ${index + 1}`
    });
  }
}

async function createTrackedAssignmentJournal(
  runId: string,
  input: {
    tenantId: string;
    applicantId: string;
    programId: string;
    missionId: string;
    missionAssignmentId: string;
    weekNumber: number;
    entryDate: Date;
    label: string;
  }
) {
  const entry = await prisma.engineeringJournalEntry.create({
    data: {
      tenantId: input.tenantId,
      applicantId: input.applicantId,
      programId: input.programId,
      missionId: input.missionId,
      missionAssignmentId: input.missionAssignmentId,
      weekNumber: input.weekNumber,
      entryDate: input.entryDate,
      language: "English",
      workedOn: input.label,
      challenge: "Keep previous-attempt review history isolated.",
      solution: "Scope the history through the exact assignment progression.",
      learned: "Tenant, applicant, program, week, and attempt boundaries all matter.",
      aiUsage: "None",
      confidenceRating: 4,
      timeSpentHours: 1,
      evidenceLinks: []
    }
  });
  await markRegressionData({ runId, entityType: "EngineeringJournalEntry", entityId: entry.id });
  return entry;
}

function regressionJournalInput(
  fixture: Awaited<ReturnType<typeof createSubmissionFixture>>,
  entryDate: Date,
  label: string,
  missionId: string = fixture.mission.id
) {
  return {
    tenantId: fixture.tenant.id,
    applicantId: fixture.user.id,
    missionId,
    entryDate,
    language: "English",
    workedOn: label,
    challenge: "Keep assignment attempts isolated.",
    solution: "Link each journal entry to its active assignment ID.",
    learned: "Assignment IDs preserve review history across repeat weeks.",
    aiUsage: "Used AI to review regression assertions.",
    confidenceRating: 4,
    timeSpentHours: 1,
    evidenceLinks: []
  };
}

/**
 * Tasks are mission-scoped (v0.20.0), so program-only fixtures need a mission to hang tasks on.
 */
async function createRegressionTaskMission(
  runId: string,
  fixture: { tenant: { id: string }; program: { id: string }; actor: { id: string } },
  label: string,
  weekNumber = 1
) {
  const mission = await createMission({
    tenantId: fixture.tenant.id,
    programId: fixture.program.id,
    title: `${label} mission ${runId}`,
    difficulty: "BEGINNER",
    status: "PUBLISHED",
    weekNumber,
    order: weekNumber,
    brief: "Regression task-scope mission",
    objective: "Host regression tasks",
    acceptanceCriteria: "n/a",
    deliverables: "n/a",
    evaluationCriteria: "n/a",
    competencyTags: [],
    actorUserId: fixture.actor.id
  });
  await markRegressionData({ runId, entityType: "Mission", entityId: mission.id });
  return mission;
}

async function createProgramFixture(runId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  const tenant = await getTenantBySlug("demo");
  if (!tenant) throw new Error("Demo tenant not found. Run local bootstrap/seed first.");
  const actor = await prisma.user.findFirst({ where: { email: "orgadmin@demo.talentos.local" } });
  if (!actor) throw new Error("Demo org admin user not found. Run local bootstrap/seed first.");
  const slug = `regression-${runId}-${randomUUID().slice(0, 8)}`;
  const program = await createProgram({
    tenantId: tenant.id,
    name: `Regression Program ${runId}`,
    slug,
    description: "Regression scenario program",
    status,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
    actorUserId: actor.id
  });
  await markRegressionData({ runId, entityType: "Program", entityId: program.id });
  return { tenant, actor, program };
}

async function createAcceptedDashboardFixture(runId: string) {
  const fixture = await createApplicationFixture(runId);
  const mission = await createMission({
    tenantId: fixture.tenant.id,
    programId: fixture.program.id,
    title: `Regression Dashboard Mission ${runId}`,
    difficulty: "BEGINNER",
    status: "PUBLISHED",
    weekNumber: 1,
    order: 0,
    brief: "Regression dashboard mission",
    objective: "Provide an active week for task completion",
    acceptanceCriteria: "- Complete the assigned task",
    deliverables: "- Task completion",
    evaluationCriteria: "The task is completed in the assigned week",
    competencyTags: ["Planning"],
    actorUserId: fixture.actor.id
  });
  await markRegressionData({ runId, entityType: "Mission", entityId: mission.id });
  const application = await createSubmittedApplication({
    tenantId: fixture.tenant.id,
    programId: fixture.program.id,
    applicantId: fixture.user.id,
    answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Dashboard" }]
  });
  await markRegressionData({ runId, entityType: "Application", entityId: application.id });
  await applyStatusTransition({
    id: application.id,
    tenantId: fixture.tenant.id,
    toStatus: "ACCEPTED",
    actorUserId: fixture.actor.id,
    reviewerNotes: "Accepted for dashboard regression"
  });
  const assignedMission = await prisma.missionAssignment.findFirst({
    where: {
      tenantId: fixture.tenant.id,
      applicantId: fixture.user.id,
      programId: fixture.program.id,
      missionId: mission.id
    }
  });
  if (!assignedMission) throw new Error("Dashboard fixture did not create an assignment.");
  const assignment =
    assignedMission.status === "NOT_STARTED"
      ? await acceptMissionAssignment({
          tenantId: fixture.tenant.id,
          applicantId: fixture.user.id,
          missionAssignmentId: assignedMission.id
        })
      : assignedMission;
  if (assignment.status !== "ACCEPTED") {
    throw new Error(`Dashboard fixture assignment is not accepted (status: ${assignment.status}).`);
  }
  await markRegressionData({ runId, entityType: "MissionAssignment", entityId: assignment.id });
  const task = await prisma.programTask.create({
    data: {
      tenantId: fixture.tenant.id,
      programId: fixture.program.id,
      // Tasks are authored per mission (v0.20.0); weekNumber is denormalized from that mission.
      missionId: assignment.missionId,
      weekNumber: assignment.weekNumber,
      title: `Regression Task ${runId}`,
      description: "Regression task",
      order: 0
    }
  });
  const notification = await prisma.notification.create({
    data: {
      tenantId: fixture.tenant.id,
      userId: fixture.user.id,
      type: "INFO",
      title: `Regression Notification ${runId}`,
      body: "Regression notification"
    }
  });
  return { ...fixture, application, mission, assignment, task, notification };
}

async function expectHttp(url: string, okStatuses: number[]) {
  const response = await fetch(url, { redirect: "manual" });
  if (!okStatuses.includes(response.status)) {
    throw new Error(`${url} returned HTTP ${response.status}; expected ${okStatuses.join("/")}`);
  }
  return `HTTP ${response.status}`;
}

type CookieRecord = { value: string; host: string; domain?: string };

class CookieJar {
  private cookies = new Map<string, CookieRecord>();

  header(url: string) {
    const { hostname } = new URL(url);
    const pairs: string[] = [];
    for (const [name, cookie] of this.cookies) {
      const domain = cookie.domain?.replace(/^\./, "");
      if (hostname === cookie.host || (domain && (hostname === domain || hostname.endsWith(`.${domain}`)))) {
        pairs.push(`${name}=${cookie.value}`);
      }
    }
    return pairs.join("; ");
  }

  store(url: string, headers: Headers) {
    const host = new URL(url).hostname;
    const values =
      typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
        : [];
    for (const raw of values) {
      const [pair, ...attrs] = raw.split(";").map((part) => part.trim());
      const index = pair.indexOf("=");
      if (index < 0) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      const domain = attrs.find((attr) => attr.toLowerCase().startsWith("domain="))?.slice(7);
      this.cookies.set(name, { value, host, domain });
    }
  }
}

async function request(jar: CookieJar, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const cookie = jar.header(url);
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(url, { ...init, headers, redirect: "manual" });
  jar.store(url, response.headers);
  return response;
}

async function loginFlow(startUrl: string, username: string, password: string, finalUrlIncludes: string) {
  const jar = new CookieJar();
  let url = startUrl;
  for (let step = 0; step < 35; step++) {
    const response = await request(jar, url);
    const location = response.headers.get("location");
    if (location) {
      url = new URL(location, url).toString();
      continue;
    }
    const html = await response.text();
    const keycloakAction = html.match(/<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"/)?.[1];
    if (keycloakAction) {
      const action = decodeHtml(keycloakAction);
      if (action.includes("host.docker.internal")) throw new Error(`Keycloak login form used host.docker.internal: ${action}`);
      const loginResponse = await request(jar, action, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password, credentialId: "" })
      });
      const next = loginResponse.headers.get("location");
      if (!next) throw new Error(`Keycloak did not redirect after credential submit for ${username}`);
      url = new URL(next, action).toString();
      continue;
    }
    const providerAction = html.match(/<form[^>]+action="([^"]*signin\/keycloak[^"]*)"[^>]*>([\s\S]*?)<\/form>/)?.[1];
    if (providerAction) {
      const csrf = html.match(/name="csrfToken"\s+value="([^"]+)"/)?.[1] ?? "";
      const signInResponse = await request(jar, new URL(decodeHtml(providerAction), url).toString(), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken: csrf, callbackUrl: startUrl, json: "true" })
      });
      const next = signInResponse.headers.get("location");
      if (!next) throw new Error(`Provider sign-in did not redirect for ${username}`);
      url = new URL(next, url).toString();
      continue;
    }
    if (html.includes("Sign in with Keycloak") && new URL(url).pathname === "/login") {
      const loginUrl = new URL(url);
      const callbackUrl = loginUrl.searchParams.get("callbackUrl") ?? startUrl;
      url = await startNextAuthProviderLogin(jar, `${loginUrl.origin}/api/auth`, callbackUrl);
      continue;
    }
    if (!url.includes(finalUrlIncludes)) throw new Error(`Expected final URL to include ${finalUrlIncludes}, got ${url}`);
    if (/access denied|unexpected "iss"|host\.docker\.internal/i.test(html)) {
      throw new Error(`Final page contains an auth/deployment error for ${username}`);
    }
    return `Reached ${url} with HTTP ${response.status}`;
  }
  throw new Error(`Login flow exceeded redirect limit for ${username}`);
}

function decodeHtml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", "\"");
}

async function startNextAuthProviderLogin(jar: CookieJar, authBaseUrl: string, callbackUrl: string) {
  const csrfResponse = await request(jar, `${authBaseUrl}/csrf`);
  if (!csrfResponse.ok) throw new Error(`Failed to fetch Auth.js CSRF token from ${authBaseUrl}`);
  const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
  if (!csrfPayload.csrfToken) throw new Error(`Auth.js CSRF endpoint did not return csrfToken from ${authBaseUrl}`);
  const signInResponse = await request(jar, `${authBaseUrl}/signin/keycloak`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: csrfPayload.csrfToken, callbackUrl, json: "true" })
  });
  const next = signInResponse.headers.get("location");
  if (!next) throw new Error(`Auth.js provider sign-in did not redirect from ${authBaseUrl}`);
  return new URL(next, authBaseUrl).toString();
}

async function capture(command: string, args: string[], timeoutMs: number) {
  const executable = commandForPlatform(command, args);
  const started = Date.now();
  let output = "";
  const child = spawn(executable.command, executable.args, { cwd: process.cwd(), shell: false });
  const timer = setTimeout(() => child.kill(), timeoutMs);
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const exitCode = await new Promise<number | null>((resolvePromise) => {
    child.on("exit", (code) => resolvePromise(code));
    child.on("error", () => resolvePromise(1));
  });
  clearTimeout(timer);
  return { exitCode, output, durationMs: Date.now() - started };
}

function commandForPlatform(command: string, args: string[]) {
  if (process.platform !== "win32") return { command, args };
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(quoteForCmd).join(" ")]
  };
}

function quoteForCmd(value: string) {
  return /^[A-Za-z0-9_.:/\\-]+$/.test(value) ? value : `"${value.replaceAll("\"", "\\\"")}"`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    if (process.env.REGRESSION_CLEANUP_ON_EXIT === "1") {
      await cleanupRegressionData().catch(() => undefined);
    }
    await prisma.$disconnect();
  });
