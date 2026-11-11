import { randomUUID } from "node:crypto";

import {
  createJob,
  createPhoto,
  listJobsForOwner,
} from "@/lib/job-repository";
import { getOrderForJob } from "@/lib/order-repository";
import { getUploadConfig } from "@/lib/upload-config";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTOS_PER_JOB,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/upload-constants";
import {
  createPhotoUploadKey,
  createPresignedUpload,
} from "@/lib/s3-upload-service";
import { getSessionOwner } from "@/lib/session";

type CreateJobPhotoRequest = {
  contentType?: unknown;
  fileName?: unknown;
  size?: unknown;
};

type CreateJobRequest = {
  photos?: unknown;
};

const JOB_RETENTION_SECONDS = 3 * 24 * 60 * 60;

class JobRequestError extends Error {}

export async function GET() {
  try {
    const owner = await getSessionOwner();
    const jobs = await listJobsForOwner(owner);

    const summaries = await Promise.all(
      jobs.map(async (job) => {
        const order = await getOrderForJob(job.jobId);

        return {
          completedPhotos: job.completedPhotos,
          createdAt: job.createdAt,
          failedPhotos: job.failedPhotos,
          jobId: job.jobId,
          orderStatus: order?.status ?? null,
          status: job.status,
          totalPhotos: job.totalPhotos,
        };
      }),
    );

    return Response.json({ jobs: summaries });
  } catch (error) {
    console.error("Jobs listing failed", error);

    return Response.json(
      { message: "The jobs could not be loaded" },
      { status: 500 },
    );
  }
}

function isPhotoRequest(value: unknown): value is CreateJobPhotoRequest {
  return Boolean(value && typeof value === "object");
}

export async function POST(request: Request) {
  try {
    const config = getUploadConfig();
    let payload: CreateJobRequest;

    try {
      payload = (await request.json()) as CreateJobRequest;
    } catch {
      return Response.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !Array.isArray(payload.photos) ||
      payload.photos.length === 0
    ) {
      return Response.json(
        { message: "At least one photo is required" },
        { status: 400 },
      );
    }

    if (payload.photos.length > MAX_PHOTOS_PER_JOB) {
      return Response.json(
        {
          message: `A job can contain at most ${MAX_PHOTOS_PER_JOB} photos`,
        },
        { status: 400 },
      );
    }

    const photos = payload.photos.map((value, index) => {
      if (!isPhotoRequest(value)) {
        throw new JobRequestError(`Invalid photo at index ${index}`);
      }

      const fileName =
        typeof value.fileName === "string" ? value.fileName.trim() : "";
      const contentType =
        typeof value.contentType === "string"
          ? value.contentType.toLowerCase()
          : "";
      const size = typeof value.size === "number" ? value.size : 0;

      if (!fileName || !ALLOWED_IMAGE_TYPES.includes(contentType)) {
        throw new JobRequestError(
          `Photo ${index + 1} has an unsupported format`,
        );
      }

      if (!Number.isSafeInteger(size) || size <= 0) {
        throw new JobRequestError(`Photo ${index + 1} is empty`);
      }

      if (size > MAX_UPLOAD_SIZE_BYTES) {
        throw new JobRequestError(
          `Photo ${index + 1} must be ${config.maxUploadSizeBytes / 1024 / 1024} MB or smaller`,
        );
      }

      return { contentType, fileName, size };
    });

    const jobId = randomUUID();
    const owner = await getSessionOwner();

    await createJob({
      expiresAt: Math.floor(Date.now() / 1000) + JOB_RETENTION_SECONDS,
      jobId,
      ownerId: owner.ownerId,
      ownerType: owner.ownerType,
      totalPhotos: photos.length,
    });

    const uploads = [];

    for (const photo of photos) {
      const photoId = randomUUID();
      const key = createPhotoUploadKey({
        fileName: photo.fileName,
        jobId,
        photoId,
      });
      const upload = await createPresignedUpload({
        contentType: photo.contentType,
        key,
        size: photo.size,
      });

      await createPhoto({
        contentType: photo.contentType,
        jobId,
        originalKey: key,
        photoId,
        size: photo.size,
      });

      uploads.push({
        contentType: upload.contentType,
        fields: upload.fields,
        fileName: photo.fileName,
        key: upload.key,
        photoId,
        size: upload.size,
        url: upload.url,
      });
    }

    return Response.json(
      {
        jobId,
        status: "created",
        uploads,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof JobRequestError) {
      return Response.json({ message: error.message }, { status: 400 });
    }

    console.error("Job creation failed", error);

    return Response.json(
      { message: "The job could not be created" },
      { status: 500 },
    );
  }
}
