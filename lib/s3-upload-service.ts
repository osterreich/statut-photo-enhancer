import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

import { getUploadConfig } from "@/lib/upload-config";

type CreateUploadRequest = {
  contentType: string;
  key: string;
  size: number;
};

export type PresignedUpload = {
  contentType: string;
  fields: Record<string, string>;
  key: string;
  size: number;
  url: string;
};

function getFileExtension(fileName: string): string {
  const extension = fileName.slice(fileName.lastIndexOf("."));

  return /^\.[a-z0-9]{1,10}$/i.test(extension) ? extension.toLowerCase() : "";
}

export function createPhotoUploadKey({
  fileName,
  jobId,
  photoId,
}: {
  fileName: string;
  jobId: string;
  photoId: string;
}): string {
  const config = getUploadConfig();

  return `${config.uploadPrefix}/jobs/${jobId}/${photoId}${getFileExtension(fileName)}`;
}

export async function createPresignedUpload({
  contentType,
  key,
  size,
}: CreateUploadRequest): Promise<PresignedUpload> {
  const config = getUploadConfig();
  const s3Client = new S3Client({ region: config.awsRegion });
  const presignedPost = await createPresignedPost(s3Client, {
    Bucket: config.bucketName,
    Conditions: [
      ["content-length-range", 1, config.maxUploadSizeBytes],
      ["eq", "$Content-Type", contentType],
    ],
    Expires: 300,
    Fields: {
      "Content-Type": contentType,
    },
    Key: key,
  });

  return {
    contentType,
    fields: presignedPost.fields,
    key,
    size,
    url: presignedPost.url,
  };
}
