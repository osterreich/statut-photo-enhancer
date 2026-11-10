import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  S3_UPLOAD_PREFIX,
} from "@/lib/upload-constants";

type UploadConfig = {
  allowedImageTypes: string[];
  awsRegion: string;
  bucketName: string;
  maxUploadSizeBytes: number;
  uploadPrefix: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getUploadConfig(): UploadConfig {
  return {
    allowedImageTypes: ALLOWED_IMAGE_TYPES,
    awsRegion: getRequiredEnv("S3_REGION"),
    bucketName: getRequiredEnv("S3_BUCKET_NAME"),
    maxUploadSizeBytes: MAX_UPLOAD_SIZE_BYTES,
    uploadPrefix: S3_UPLOAD_PREFIX,
  };
}
