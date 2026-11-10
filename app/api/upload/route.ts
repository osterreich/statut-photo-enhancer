import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { getUploadConfig } from "@/lib/upload-config";

function getFileExtension(fileName: string): string {
  const extension = fileName.slice(fileName.lastIndexOf("."));

  return /^\.[a-z0-9]{1,10}$/i.test(extension) ? extension.toLowerCase() : "";
}

export async function POST(request: Request) {
  try {
    const config = getUploadConfig();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { message: "Please select an image file" },
        { status: 400 },
      );
    }

    const contentType = file.type.toLowerCase();

    if (!config.allowedImageTypes.includes(contentType)) {
      return Response.json(
        { message: "This image format is not supported" },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return Response.json(
        { message: "The selected file is empty" },
        { status: 400 },
      );
    }

    if (file.size > config.maxUploadSizeBytes) {
      return Response.json(
        { message: "The selected file is too large" },
        { status: 413 },
      );
    }

    const now = new Date();
    const datePrefix = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      String(now.getUTCDate()).padStart(2, "0"),
    ].join("/");
    const key = `${config.uploadPrefix}/${datePrefix}/${crypto.randomUUID()}${getFileExtension(file.name)}`;
    const body = Buffer.from(await file.arrayBuffer());
    const s3Client = new S3Client({ region: config.awsRegion });

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Body: body,
        ContentLength: file.size,
        ContentType: contentType,
        Key: key,
      }),
    );

    return Response.json({
      contentType,
      key,
      size: file.size,
    });
  } catch (error) {
    console.error("Image upload failed", error);

    return Response.json(
      { message: "The image could not be uploaded" },
      { status: 500 },
    );
  }
}
