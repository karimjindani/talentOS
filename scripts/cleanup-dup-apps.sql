-- Delete duplicate active applications, keeping the most recent one per applicant+program
DELETE FROM applications
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "applicantId", "programId"
      ORDER BY "createdAt" DESC
    ) AS rn
    FROM applications
    WHERE status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','ACCEPTED','WAITLISTED')
  ) t WHERE rn = 1
)
AND status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','ACCEPTED','WAITLISTED');
