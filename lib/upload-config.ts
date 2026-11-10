type UploadConfig = {
  allowedImageTypes: string[];
  awsRegion: string;
  bucketName: string;
  maxUploadSizeBytes: number;
  uploadPrefix: string;
};

const MAX_UPLOAD_SIZE_MB = 10;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const S3_UPLOAD_PREFIX = "uploads";

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
    maxUploadSizeBytes: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    uploadPrefix: S3_UPLOAD_PREFIX,
  };
}
