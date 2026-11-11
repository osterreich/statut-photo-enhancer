import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

import {
  getJob,
  markJobProcessing,
  markPhotoCompleted,
  markPhotoFailed,
  markPhotoProcessing,
} from "@/lib/job-repository";
import { JOB_STATUSES, PHOTO_STATUSES } from "@/lib/job-types";
import {
  createPhotoPreviewKey,
  createPhotoResultKey,
  readS3Object,
  writeS3Object,
} from "@/lib/s3-storage-service";

const DEFAULT_WATERMARK_PATH = path.join(
  process.cwd(),
  "public",
  "watermark.png",
);

function getWatermarkPath(): string {
  return process.env.WATERMARK_PATH?.trim() || DEFAULT_WATERMARK_PATH;
}

async function createPreview(original: Buffer): Promise<Buffer> {
  const image = sharp(original)
    .rotate()
    .resize({
      fit: "inside",
      height: 640,
      withoutEnlargement: true,
      width: 640,
    });
  const watermarkPath = getWatermarkPath();

  if (!fs.existsSync(watermarkPath)) {
    return image.jpeg({ quality: 82 }).toBuffer();
  }

  const watermark = await sharp(watermarkPath)
    .resize({ width: 220, withoutEnlargement: true })
    .ensureAlpha()
    .rotate(-25, {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
    })
    .png()
    .toBuffer();

  return image
    .composite([
      {
        blend: "over",
        input: watermark,
        tile: true,
      },
    ])
    .jpeg({ quality: 82 })
    .toBuffer();
}

export async function processJob(jobId: string): Promise<void> {
  const result = await getJob(jobId);

  if (!result) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (
    result.job.status === JOB_STATUSES.COMPLETED ||
    result.job.status === JOB_STATUSES.PARTIALLY_FAILED
  ) {
    return;
  }

  if (result.job.status === JOB_STATUSES.QUEUED) {
    await markJobProcessing(jobId);
  }

  for (const photo of result.photos) {
    if (photo.status !== PHOTO_STATUSES.QUEUED) {
      continue;
    }

    try {
      await markPhotoProcessing(jobId, photo.photoId);

      const original = await readS3Object(photo.originalKey);
      const resultKey = createPhotoResultKey({
        jobId,
        originalKey: photo.originalKey,
        photoId: photo.photoId,
      });
      const previewKey = createPhotoPreviewKey({
        jobId,
        photoId: photo.photoId,
      });

      await writeS3Object({
        body: original,
        contentType: photo.contentType,
        key: resultKey,
      });

      const preview = await createPreview(original);

      await writeS3Object({
        body: preview,
        contentType: "image/jpeg",
        key: previewKey,
      });

      await markPhotoCompleted(jobId, photo.photoId, previewKey, resultKey);
    } catch (error) {
      await markPhotoFailed(
        jobId,
        photo.photoId,
        error instanceof Error ? error.message : "Photo processing failed",
      );
    }
  }
}
