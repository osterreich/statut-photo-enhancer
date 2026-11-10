import { createPresignedUpload } from "@/lib/s3-upload-service";
import { getUploadConfig } from "@/lib/upload-config";

type UploadRequest = {
  contentType?: unknown;
  fileName?: unknown;
  size?: unknown;
};

export async function POST(request: Request) {
  try {
    const config = getUploadConfig();
    const payload = (await request.json()) as UploadRequest;
    const fileName = typeof payload.fileName === "string" ? payload.fileName : "";
    const contentType =
      typeof payload.contentType === "string"
        ? payload.contentType.toLowerCase()
        : "";
    const size = typeof payload.size === "number" ? payload.size : 0;

    if (!fileName || !config.allowedImageTypes.includes(contentType)) {
      return Response.json(
        { message: "This image format is not supported" },
        { status: 400 },
      );
    }

    if (!Number.isSafeInteger(size) || size <= 0) {
      return Response.json(
        { message: "The selected file is empty" },
        { status: 400 },
      );
    }

    if (size > config.maxUploadSizeBytes) {
      return Response.json(
        { message: "The selected file is too large" },
        { status: 413 },
      );
    }

    const upload = await createPresignedUpload({
      contentType,
      fileName,
      size,
    });

    return Response.json(upload);
  } catch (error) {
    console.error("Upload URL creation failed", error);

    return Response.json(
      { message: "The upload URL could not be created" },
      { status: 500 },
    );
  }
}
