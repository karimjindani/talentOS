-- Get the latest approved, unconsumed recruiter access request with all details
SELECT r.id, r."recruiterEmail", r.status, r."expiresAt", r."consumedAt",
       r."graduateId", gp.slug, gp."publicProfileEnabled", gp."consentStatus",
       gp.bio, gp."overallRating", gp."graduationDate",
       u.name, u.email
FROM recruiter_access_requests r
JOIN graduate_profiles gp ON gp.id = r."graduateId"
JOIN users u ON u.id = gp."userId"
WHERE r.status = 'APPROVED' AND r."consumedAt" IS NULL
ORDER BY r."createdAt" DESC
LIMIT 5;
