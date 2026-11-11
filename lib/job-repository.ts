import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { getDynamoDbConfig } from "@/lib/dynamodb-config";
import {
  JOB_STATUSES,
  JOB_OWNER_TYPES,
  PHOTO_STATUSES,
  type JobOwner,
  type JobRecord,
  type JobWithPhotos,
  type PhotoRecord,
} from "@/lib/job-types";
import { getDynamoDbDocumentClient } from "@/lib/dynamodb-client";

type JobItem = JobRecord & {
  PK: string;
  SK: "JOB";
  entityType: "job";
};

type PhotoItem = PhotoRecord & {
  PK: string;
  SK: string;
  entityType: "photo";
};

type CreateJobInput = {
  expiresAt: number;
  jobId: string;
  ownerId: string;
  ownerType: JobOwner["ownerType"];
  totalPhotos: number;
};

type CreatePhotoInput = {
  contentType: string;
  jobId: string;
  originalKey: string;
  photoId: string;
  size: number;
};

function jobKey(jobId: string) {
  return {
    PK: `JOB#${jobId}`,
    SK: "JOB" as const,
  };
}

function photoKey(jobId: string, photoId: string) {
  return {
    PK: `JOB#${jobId}`,
    SK: `PHOTO#${photoId}`,
  };
}

function now(): string {
  return new Date().toISOString();
}

function getTableName(): string {
  return getDynamoDbConfig().tableName;
}

function isJobItem(item: unknown): item is JobItem {
  return Boolean(item && typeof item === "object" && "jobId" in item);
}

function isPhotoItem(item: unknown): item is PhotoItem {
  return Boolean(item && typeof item === "object" && "photoId" in item);
}

function withoutStorageKeys<T extends object>(item: T): Omit<T, "PK" | "SK" | "entityType"> {
  return Object.fromEntries(
    Object.entries(item).filter(
      ([key]) => key !== "PK" && key !== "SK" && key !== "entityType",
    ),
  ) as Omit<T, "PK" | "SK" | "entityType">;
}

function toJobRecord(item: JobItem): JobRecord {
  return withoutStorageKeys(item);
}

function toPhotoRecord(item: PhotoItem): PhotoRecord {
  return withoutStorageKeys(item);
}

export async function createJob({
  expiresAt,
  jobId,
  ownerId,
  ownerType,
  totalPhotos,
}: CreateJobInput): Promise<JobRecord> {
  if (!Number.isSafeInteger(totalPhotos) || totalPhotos <= 0) {
    throw new Error("A job must contain at least one photo");
  }

  if (!ownerId.trim()) {
    throw new Error("A job owner is required");
  }

  if (!Object.values(JOB_OWNER_TYPES).includes(ownerType)) {
    throw new Error("Unsupported job owner type");
  }

  const timestamp = now();
  const item: JobItem = {
    ...jobKey(jobId),
    completedPhotos: 0,
    createdAt: timestamp,
    entityType: "job",
    expiresAt,
    failedPhotos: 0,
    jobId,
    ownerId,
    ownerType,
    remainingPhotos: totalPhotos,
    status: JOB_STATUSES.CREATED,
    totalPhotos,
    updatedAt: timestamp,
  };

  await getDynamoDbDocumentClient().send(
    new PutCommand({
      ConditionExpression: "attribute_not_exists(PK)",
      Item: item,
      TableName: getTableName(),
    }),
  );

  return toJobRecord(item);
}

export async function createPhoto({
  contentType,
  jobId,
  originalKey,
  photoId,
  size,
}: CreatePhotoInput): Promise<PhotoRecord> {
  const timestamp = now();
  const item: PhotoItem = {
    ...photoKey(jobId, photoId),
    attempts: 0,
    contentType,
    createdAt: timestamp,
    entityType: "photo",
    jobId,
    originalKey,
    photoId,
    size,
    status: PHOTO_STATUSES.PENDING_UPLOAD,
    updatedAt: timestamp,
  };

  await getDynamoDbDocumentClient().send(
    new PutCommand({
      ConditionExpression: "attribute_not_exists(PK)",
      Item: item,
      TableName: getTableName(),
    }),
  );

  return toPhotoRecord(item);
}

export async function markPhotoQueued(
  jobId: string,
  photoId: string,
): Promise<void> {
  await getDynamoDbDocumentClient().send(
    new UpdateCommand({
      ConditionExpression: "#status = :pendingUpload",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":pendingUpload": PHOTO_STATUSES.PENDING_UPLOAD,
        ":queued": PHOTO_STATUSES.QUEUED,
        ":timestamp": now(),
      },
      Key: photoKey(jobId, photoId),
      TableName: getTableName(),
      UpdateExpression: "SET #status = :queued, updatedAt = :timestamp",
    }),
  );
}

export async function startJob(jobId: string): Promise<void> {
  await getDynamoDbDocumentClient().send(
    new UpdateCommand({
      ConditionExpression: "#status = :created",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":created": JOB_STATUSES.CREATED,
        ":queued": JOB_STATUSES.QUEUED,
        ":timestamp": now(),
      },
      Key: jobKey(jobId),
      TableName: getTableName(),
      UpdateExpression: "SET #status = :queued, updatedAt = :timestamp",
    }),
  );
}

export async function markJobProcessing(jobId: string): Promise<void> {
  await getDynamoDbDocumentClient().send(
    new UpdateCommand({
      ConditionExpression: "#status = :queued",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":processing": JOB_STATUSES.PROCESSING,
        ":queued": JOB_STATUSES.QUEUED,
        ":timestamp": now(),
      },
      Key: jobKey(jobId),
      TableName: getTableName(),
      UpdateExpression: "SET #status = :processing, updatedAt = :timestamp",
    }),
  );
}

export async function markPhotoProcessing(
  jobId: string,
  photoId: string,
): Promise<void> {
  await getDynamoDbDocumentClient().send(
    new UpdateCommand({
      ConditionExpression: "#status = :queued",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":one": 1,
        ":processing": PHOTO_STATUSES.PROCESSING,
        ":queued": PHOTO_STATUSES.QUEUED,
        ":timestamp": now(),
        ":zero": 0,
      },
      Key: photoKey(jobId, photoId),
      TableName: getTableName(),
      UpdateExpression:
        "SET #status = :processing, attempts = if_not_exists(attempts, :zero) + :one, updatedAt = :timestamp REMOVE errorMessage",
    }),
  );
}

async function finalizeJobIfReady(jobId: string): Promise<void> {
  const result = await getJob(jobId);

  if (!result || result.job.remainingPhotos !== 0) {
    return;
  }

  const status =
    result.job.failedPhotos > 0
      ? JOB_STATUSES.PARTIALLY_FAILED
      : JOB_STATUSES.COMPLETED;

  await getDynamoDbDocumentClient()
    .send(
      new UpdateCommand({
        ConditionExpression:
          "#remainingPhotos = :zero AND (#status = :queued OR #status = :processing)",
        ExpressionAttributeNames: {
          "#remainingPhotos": "remainingPhotos",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":completed": status,
          ":processing": JOB_STATUSES.PROCESSING,
          ":queued": JOB_STATUSES.QUEUED,
          ":timestamp": now(),
          ":zero": 0,
        },
        Key: jobKey(jobId),
        TableName: getTableName(),
        UpdateExpression: "SET #status = :completed, updatedAt = :timestamp",
      }),
    )
    .catch((error: unknown) => {
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw error;
      }

      // Another worker may have finalized the job first.
    });
}

export async function markPhotoCompleted(
  jobId: string,
  photoId: string,
  resultKey: string,
): Promise<void> {
  const timestamp = now();

  await getDynamoDbDocumentClient().send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            ConditionExpression: "#status = :processing",
            ExpressionAttributeNames: {
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":completed": PHOTO_STATUSES.COMPLETED,
              ":processing": PHOTO_STATUSES.PROCESSING,
              ":resultKey": resultKey,
              ":timestamp": timestamp,
            },
            Key: photoKey(jobId, photoId),
            TableName: getTableName(),
            UpdateExpression:
              "SET #status = :completed, resultKey = :resultKey, updatedAt = :timestamp REMOVE errorMessage",
          },
        },
        {
          Update: {
            ConditionExpression: "remainingPhotos >= :one",
            ExpressionAttributeValues: {
              ":one": 1,
              ":timestamp": timestamp,
            },
            Key: jobKey(jobId),
            TableName: getTableName(),
            UpdateExpression:
              "SET completedPhotos = completedPhotos + :one, remainingPhotos = remainingPhotos - :one, updatedAt = :timestamp",
          },
        },
      ],
    }),
  );

  await finalizeJobIfReady(jobId);
}

export async function markPhotoFailed(
  jobId: string,
  photoId: string,
  errorMessage: string,
): Promise<void> {
  const timestamp = now();

  await getDynamoDbDocumentClient().send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            ConditionExpression: "#status = :processing",
            ExpressionAttributeNames: {
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":failed": PHOTO_STATUSES.FAILED,
              ":processing": PHOTO_STATUSES.PROCESSING,
              ":errorMessage": errorMessage,
              ":timestamp": timestamp,
            },
            Key: photoKey(jobId, photoId),
            TableName: getTableName(),
            UpdateExpression:
              "SET #status = :failed, errorMessage = :errorMessage, updatedAt = :timestamp",
          },
        },
        {
          Update: {
            ConditionExpression: "remainingPhotos >= :one",
            ExpressionAttributeValues: {
              ":one": 1,
              ":timestamp": timestamp,
            },
            Key: jobKey(jobId),
            TableName: getTableName(),
            UpdateExpression:
              "SET failedPhotos = failedPhotos + :one, remainingPhotos = remainingPhotos - :one, updatedAt = :timestamp",
          },
        },
      ],
    }),
  );

  await finalizeJobIfReady(jobId);
}

export async function getJob(jobId: string): Promise<JobWithPhotos | null> {
  const result = await getDynamoDbDocumentClient().send(
    new QueryCommand({
      ConsistentRead: true,
      ExpressionAttributeValues: {
        ":pk": `JOB#${jobId}`,
      },
      KeyConditionExpression: "PK = :pk",
      TableName: getTableName(),
    }),
  );

  const jobItem = result.Items?.find(
    (item): item is JobItem => isJobItem(item) && item.SK === "JOB",
  );

  if (!jobItem) {
    return null;
  }

  const photos = (result.Items ?? [])
    .filter(
      (item): item is PhotoItem => isPhotoItem(item) && item.SK !== "JOB",
    )
    .map(toPhotoRecord);

  return {
    job: toJobRecord(jobItem),
    photos,
  };
}

export async function getJobForOwner(
  jobId: string,
  owner: JobOwner,
): Promise<JobWithPhotos | null> {
  const result = await getJob(jobId);

  if (
    !result ||
    result.job.ownerId !== owner.ownerId ||
    result.job.ownerType !== owner.ownerType
  ) {
    return null;
  }

  return result;
}
