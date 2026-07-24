-- Prerequisite program tasks (v0.20.0): when true, the mission's own steps (Review Brief / Study
-- Tutorial / Submission) stay locked for the applicant until this task is completed.

-- AlterTable
ALTER TABLE "program_tasks" ADD COLUMN     "isPrerequisite" BOOLEAN NOT NULL DEFAULT false;
