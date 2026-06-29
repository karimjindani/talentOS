import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getBucket, getS3Client } from "./client";

export * from "./keys";
export { getBucket, getS3Client } from "./client";

const DEFAULT_TTL_SECONDS = 300;

/** Presigned PUT URL the browser uses to upload directly to MinIO. */
export function getPresignedUploadUrl({
  key,
  contentType,
  expiresIn = DEFAULT_TTL_SECONDS
}: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const command = new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType });
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

/** Presigned GET URL for downloading a private object. */
export function getPresignedDownloadUrl({
  key,
  expiresIn = DEFAULT_TTL_SECONDS
}: {
  key: string;
  expiresIn?: number;
}): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

export function deleteObject(key: string) {
  return getS3Client().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}
