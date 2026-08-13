-- Get the latest approved, unconsumed recruiter access request token (hashed)
SELECT r.id, r.token, r."recruiterEmail", r.status, r."consumedAt",
       gp.slug, gp."publicProfileEnabled", gp."consentStatus"
FROM recruiter_access_requests r
JOIN graduate_profiles gp ON gp.id = r."graduateId"
WHERE r.status = 'APPROVED' AND r."consumedAt" IS NULL
ORDER BY r."createdAt" DESC
LIMIT 1;
