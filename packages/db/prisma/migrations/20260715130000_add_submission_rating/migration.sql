-- Store the reviewer-assigned mission score used to calculate graduate ratings.
ALTER TABLE "submissions" ADD COLUMN "rating" DOUBLE PRECISION;

ALTER TABLE "submissions"
ADD CONSTRAINT "submissions_rating_range_check"
CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));
