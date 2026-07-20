// File storage backed by a real AWS S3 bucket (replaces Manus's storage
// proxy). Requires S3_BUCKET, AWS_REGION, and standard AWS credentials
// (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, or an IAM role if hosted on
// AWS). Optionally set S3_PUBLIC_BASE_URL (e.g. a CloudFront domain) if the
// bucket is served through a CDN instead of directly.
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    if (!ENV.s3.region) {
      throw new Error("AWS_REGION is not configured");
    }
    _client = new S3Client({ region: ENV.s3.region });
  }
  return _client;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function publicUrlFor(key: string): string {
  if (ENV.s3.publicBaseUrl) {
    return `${ENV.s3.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }
  return `https://${ENV.s3.bucket}.s3.${ENV.s3.region}.amazonaws.com/${key}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (!ENV.s3.bucket) {
    throw new Error("S3_BUCKET is not configured");
  }
  const key = normalizeKey(relKey);

  await getClient().send(
    new PutObjectCommand({
      Bucket: ENV.s3.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );

  return { key, url: publicUrlFor(key) };
}

/**
 * Returns a short-lived signed URL for a private object. Use this if the
 * bucket is NOT public; if the bucket/CDN serves objects publicly, you can
 * just use the `url` returned by storagePut directly instead.
 */
export async function storageGet(
  relKey: string,
  expiresInSeconds = 3600
): Promise<{ key: string; url: string }> {
  if (!ENV.s3.bucket) {
    throw new Error("S3_BUCKET is not configured");
  }
  const key = normalizeKey(relKey);
  const url = await getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: ENV.s3.bucket, Key: key }),
    { expiresIn: expiresInSeconds }
  );
  return { key, url };
}
