-- Update the latest approved, unconsumed request with a new token hash for testing
UPDATE recruiter_access_requests
SET token = 'd22d01bd2c7181774ca5126f6527f5f1a74021a895aac73e6eb60998f862afa1',
    "consumedAt" = NULL
WHERE id = (
  SELECT id FROM recruiter_access_requests
  WHERE status = 'APPROVED'
  ORDER BY "createdAt" DESC
  LIMIT 1
);
