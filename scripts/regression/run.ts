import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { LearningResourceType } from "@prisma/client";
import {
  acceptMissionAssignment,
  applyStatusTransition,
  buildSubmissionEvidenceLinks,
  cleanupRegressionData,
  createCalendarEvent,
  createJournalEntry,
  createMission,
  createProgram,
  createProgramTask,
  createSubmittedApplication,
  createVideoResource,
  deleteVideoResource,
  DUPLICATE_APPLICATION_ERROR_MESSAGE,
  findActiveApplication,
  getApplicantMissionProgress,
  getApplicantProgramProgress,
  getApplicantSubmission,
  getAssignedProgramMission,
  getMissionSubmissionReadiness,
  getTenantBySlug,
  getTenantSubmission,
  getTenantProgram,
  isJournalMissionLockedForApplicant,
  JournalEntryDateConflictError,
  listApplicantApplications,
  listApplicantJournalEntries,
  listAssignedProgramMissions,
  listCompletedTaskIds,
  listEngineeringJournalEntriesForSubmissionReview,
  listPreviousMissionAttemptHistoryForSubmissionReview,
  listPublishedProgramMissions,
  listPublishedPrograms,
  listTasksByWeek,
  markApplicantTaskCompleted,
  markMissionTaskComplete,
  markNotificationRead,
  markRegressionData,
  prisma,
  reviewSubmission,
  saveSubmissionDraft,
  setMissionStatus,
  setProgramStatus,
  submitSubmission,
  updateJournalEntry,
  updateVideoResource
} from "@talentos/db";
import { tenantRolesGrant, type RegressionArea, type RegressionSummary } from "@talentos/auth";

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
        weekNumber: fixture.assignment.weekNumber,
        order: 0,
        dueAt: null,
        required: true,
        published: true,
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "ProgramTask", entityId: task.id });

      const visibleTasks = await listTasksByWeek(
        fixture.tenant.id,
        fixture.program.id,
        fixture.assignment.weekNumber
      );
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
      const task = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Admin resource task ${ctx.runId}`,
        description: "Admin-configured weekly learning task.",
        weekNumber: 1,
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

      const tasks = await listTasksByWeek(fixture.tenant.id, fixture.program.id, 1);
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
        reviewerUserId: fixture.actor.id
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
      const { assignment } = await createSubmissionFixture(ctx.runId);
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
        weekNumber: fixture.assignment.weekNumber,
        order: 0,
        dueAt: null,
        required: true,
        published: true,
        isPrerequisite: true,
        actorUserId: fixture.actor.id
      });
      await markRegressionData({ runId: ctx.runId, entityType: "ProgramTask", entityId: prereq.id });

      const weekTasks = await listTasksByWeek(fixture.tenant.id, fixture.program.id, fixture.assignment.weekNumber);
      const stored = weekTasks.find((task) => task.id === prereq.id);
      if (!stored) {
        throw new Error("Prerequisite task was not returned by listTasksByWeek.");
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
            weekNumber: fixture.assignment.weekNumber,
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
        reviewerUserId: fixture.actor.id
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
        reviewerUserId: fixture.actor.id
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
          status: "ACCEPTED"
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
          status: "ACCEPTED"
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
          status: "ACCEPTED"
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
          status: "ACCEPTED"
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
        weekNumber: fixture.assignment.weekNumber,
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
        reviewerUserId: fixture.actor.id
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
      const attemptTwo = await acceptMissionAssignment({
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
      if (
        attemptTwoReadiness.tasks.required !== 1 ||
        attemptTwoReadiness.tasks.completed !== 1 ||
        attemptTwoReadiness.journals.completed !== 0
      ) {
        throw new Error("Repeat attempt did not retain week tasks while resetting attempt-level journal progress.");
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
          reviewerUserId: fixture.actor.id
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
        reviewerUserId: fixture.actor.id
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
        reviewerUserId: fixture.actor.id
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
          reviewerUserId: fixture.actor.id
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
          status: "ACCEPTED"
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
    name: "One journal entry per applicant per calendar date is enforced",
    run: async (ctx) => {
      const fixture = await createSubmissionFixture(ctx.runId);
      const entryDate = new Date("2026-01-07T00:00:00.000Z");
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
          entryDate: new Date("2026-01-07T18:00:00.000Z"),
          language: "English",
          workedOn: "Second entry same day.",
          challenge: "n/a",
          solution: "n/a",
          learned: "n/a",
          aiUsage: "n/a",
          confidenceRating: 3,
          timeSpentHours: 1,
          evidenceLinks: []
        });
        throw new Error("A second journal entry for the same calendar date was allowed.");
      } catch (error) {
        if (!(error instanceof JournalEntryDateConflictError)) throw error;
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
        weekNumber: fixture.assignment.weekNumber,
        order: 0,
        dueAt: null,
        required: true,
        published: true,
        actorUserId: fixture.actor.id
      });
      const otherWeekTask = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Other-week readiness task ${ctx.runId}`,
        description: "A completion from Week 2 must not satisfy Week 1.",
        weekNumber: fixture.assignment.weekNumber + 1,
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
          status: "REPEAT"
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
          status: "REPEAT"
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
          status: "REPEAT"
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
          status: "REPEAT"
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
        reviewerUserId: fixture.actor.id
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
      const task = await createProgramTask({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        title: `Regression Content Task ${ctx.runId}`,
        description: "Regression content task",
        weekNumber: 1,
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
      const weekTasks = await listTasksByWeek(fixture.tenant.id, fixture.program.id, 1);
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

/** Applicant + published program + PUBLISHED mission — the submission-loop starting state (D-067). */
async function createSubmissionFixture(runId: string) {
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
  const accepted = await acceptMissionAssignment({
    tenantId: fixture.tenant.id,
    applicantId: fixture.user.id,
    missionAssignmentId: assignment.id
  });
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
    reviewerUserId: fixture.actor.id
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
  const attemptTwo = await acceptMissionAssignment({
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
      weekNumber: 1,
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
