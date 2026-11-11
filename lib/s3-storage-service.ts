import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getUploadConfig } from "@/lib/upload-config";

const RESULT_PREFIX = "processed/jobs";

const globalForS3 = globalThis as typeof globalThis & {
  s3Client?: S3Client;
  s3Region?: string;
};

export function getS3Client(): S3Client {
  const config = getUploadConfig();

  if (!globalForS3.s3Client || globalForS3.s3Region !== config.awsRegion) {
    globalForS3.s3Client = new S3Client({ region: config.awsRegion });
    globalForS3.s3Region = config.awsRegion;
  }

  return globalForS3.s3Client;
}

function getExtension(key: string): string {
  const extension = key.slice(key.lastIndexOf("."));

  return /^\.[a-z0-9]{1,10}$/i.test(extension) ? extension.toLowerCase() : ".jpg";
}

export function createPhotoResultKey({
  jobId,
  originalKey,
  photoId,
}: {
  jobId: string;
  originalKey: string;
  photoId: string;
}): string {
  return `${RESULT_PREFIX}/${jobId}/${photoId}/result${getExtension(originalKey)}`;
}

export function createPhotoPreviewKey({
  jobId,
  photoId,
}: {
  jobId: string;
  photoId: string;
}): string {
  return `${RESULT_PREFIX}/${jobId}/${photoId}/preview.jpg`;
}

export async function readS3Object(key: string): Promise<Buffer> {
  const config = getUploadConfig();
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`S3 object has no body: ${key}`);
  }

  return Buffer.from(await response.Body.transformToByteArray());
}

export async function writeS3Object({
  body,
  contentType,
  key,
}: {
  body: Buffer;
  contentType: string;
  key: string;
}): Promise<void> {
  const config = getUploadConfig();

  await getS3Client().send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucketName,
      ContentType: contentType,
      Key: key,
    }),
  );
}

export async function createS3DownloadUrl(
  key: string,
  expiresIn = 900,
): Promise<string> {
  const config = getUploadConfig();

  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
    { expiresIn },
  );
}
