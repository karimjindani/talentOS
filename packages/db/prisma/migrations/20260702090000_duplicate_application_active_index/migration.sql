-- Prevent duplicate active applications for the same applicant and program.
-- REJECTED applications are intentionally excluded so applicants may re-apply.
CREATE UNIQUE INDEX "applications_applicantId_programId_active_key"
ON "applications"("applicantId", "programId")
WHERE "status" IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'WAITLISTED');
