-- Check the regression-applicant graduate profile and their accepted submissions
SELECT gp.id, gp.slug, gp."publicProfileEnabled", gp."consentStatus", gp.bio,
       u.name, u.email,
       (SELECT COUNT(*) FROM submissions s WHERE s."applicantId" = u.id AND s.status = 'ACCEPTED' AND s.rating IS NOT NULL) AS accepted_count
FROM graduate_profiles gp
JOIN users u ON u.id = gp."userId"
WHERE gp.slug = 'regression-applicant';
