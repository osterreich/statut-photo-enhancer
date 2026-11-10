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
  const maxUploadSizeMb = Number(getRequiredEnv("MAX_UPLOAD_SIZE_MB"));

  if (!Number.isFinite(maxUploadSizeMb) || maxUploadSizeMb <= 0) {
    throw new Error("MAX_UPLOAD_SIZE_MB must be a positive number");
  }

  const allowedImageTypes = getRequiredEnv("ALLOWED_IMAGE_TYPES")
    .split(",")
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean);

  if (allowedImageTypes.length === 0) {
    throw new Error("ALLOWED_IMAGE_TYPES must contain at least one MIME type");
  }

  return {
    allowedImageTypes,
    awsRegion: getRequiredEnv("S3_REGION"),
    bucketName: getRequiredEnv("S3_BUCKET_NAME"),
    maxUploadSizeBytes: Math.floor(maxUploadSizeMb * 1024 * 1024),
    uploadPrefix: getRequiredEnv("S3_UPLOAD_PREFIX").replace(/^\/+|\/+$/g, ""),
  };
}
