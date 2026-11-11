import {
  getJobForOwner,
  markPhotoQueued,
  startJob,
} from "@/lib/job-repository";
import { JOB_STATUSES, PHOTO_STATUSES } from "@/lib/job-types";
import { getSessionOwner } from "@/lib/session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const owner = await getSessionOwner();
  const result = await getJobForOwner(jobId, owner);

  if (!result) {
    return Response.json({ message: "Job not found" }, { status: 404 });
  }

  if (result.job.status !== JOB_STATUSES.CREATED) {
    return Response.json(
      {
        jobId,
        status: result.job.status,
      },
      { status: 200 },
    );
  }

  if (
    result.photos.length !== result.job.totalPhotos ||
    result.photos.some((photo) => photo.status !== PHOTO_STATUSES.PENDING_UPLOAD)
  ) {
    return Response.json(
      { message: "Not all photos are ready for processing" },
      { status: 409 },
    );
  }

  await Promise.all(
    result.photos.map((photo) => markPhotoQueued(jobId, photo.photoId)),
  );
  await startJob(jobId);

  return Response.json({
    jobId,
    status: JOB_STATUSES.QUEUED,
    totalPhotos: result.job.totalPhotos,
  });
}
