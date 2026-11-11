export const JOB_STATUSES = {
  CREATED: "created",
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  PARTIALLY_FAILED: "partially_failed",
} as const;

export type JobStatus = (typeof JOB_STATUSES)[keyof typeof JOB_STATUSES];

export const JOB_OWNER_TYPES = {
  SESSION: "session",
  USER: "user",
} as const;

export type JobOwnerType =
  (typeof JOB_OWNER_TYPES)[keyof typeof JOB_OWNER_TYPES];

export type JobOwner = {
  ownerId: string;
  ownerType: JobOwnerType;
};

export const PHOTO_STATUSES = {
  PENDING_UPLOAD: "pending_upload",
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type PhotoStatus =
  (typeof PHOTO_STATUSES)[keyof typeof PHOTO_STATUSES];

export type JobRecord = {
  jobId: string;
  ownerId: string;
  ownerType: JobOwnerType;
  status: JobStatus;
  totalPhotos: number;
  completedPhotos: number;
  failedPhotos: number;
  remainingPhotos: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: number;
};

export type PhotoRecord = {
  jobId: string;
  photoId: string;
  status: PhotoStatus;
  originalKey: string;
  previewKey?: string;
  contentType: string;
  size: number;
  resultKey?: string;
  attempts: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type JobWithPhotos = {
  job: JobRecord;
  photos: PhotoRecord[];
};
