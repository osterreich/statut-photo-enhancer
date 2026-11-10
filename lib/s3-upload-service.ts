import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

import { getUploadConfig } from "@/lib/upload-config";

type CreateUploadRequest = {
  contentType: string;
  fileName: string;
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

function createUploadKey(fileName: string, uploadPrefix: string): string {
  const now = new Date();
  const datePrefix = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("/");

  return `${uploadPrefix}/${datePrefix}/${crypto.randomUUID()}${getFileExtension(fileName)}`;
}

export async function createPresignedUpload({
  contentType,
  fileName,
  size,
}: CreateUploadRequest): Promise<PresignedUpload> {
  const config = getUploadConfig();
  const key = createUploadKey(fileName, config.uploadPrefix);
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
