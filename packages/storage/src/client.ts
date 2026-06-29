import { S3Client } from "@aws-sdk/client-s3";

/** The bucket all TalentOS objects live in (per-tenant prefixes are inside the key). */
export function getBucket(): string {
  return process.env.S3_BUCKET ?? "talentos";
}

let cached: S3Client | undefined;

/**
 * S3 client pointed at MinIO (S3-compatible). Path-style addressing is required for MinIO; the same
 * client works against any S3-compatible endpoint by changing the env config only.
 */
export function getS3Client(): S3Client {
  if (!cached) {
    cached = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT ?? "http://host.docker.internal:9000",
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") !== "false",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "talentos",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "talentos_dev_password"
      }
    });
  }
  return cached;
}
