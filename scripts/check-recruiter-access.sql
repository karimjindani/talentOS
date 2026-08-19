SELECT r."recruiterEmail", r.status, r."expiresAt", r."consumedAt",
       gp.slug, gp."publicProfileEnabled", gp."consentStatus"
FROM recruiter_access_requests r
JOIN graduate_profiles gp ON gp.id = r."graduateId"
ORDER BY r."createdAt" DESC
LIMIT 10;
