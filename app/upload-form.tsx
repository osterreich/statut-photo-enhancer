"use client";

import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useState } from "react";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTOS_PER_JOB,
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
} from "@/lib/upload-constants";

type UploadState =
  | { kind: "idle"; message: string }
  | { kind: "success"; jobId: string; message: string }
  | { kind: "error"; message: string };

type JobUpload = {
  contentType: string;
  fields: Record<string, string>;
  fileName: string;
  key: string;
  photoId: string;
  size: number;
  url: string;
};

type CreateJobResponse = {
  jobId?: string;
  message?: string;
  uploads?: JobUpload[];
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function UploadForm() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [state, setState] = useState<UploadState>({
    kind: "idle",
    message: "",
  });

  function handleFileSelection(fileList: FileList | File[]) {
    const files = Array.from(fileList);

    if (files.length === 0) {
      return;
    }

    if (files.length > MAX_PHOTOS_PER_JOB) {
      setSelectedFiles([]);
      setState({
        kind: "error",
        message: `You can upload up to ${MAX_PHOTOS_PER_JOB} photos at once`,
      });
      return;
    }

    const invalidType = files.find(
      (file) => !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase()),
    );

    if (invalidType) {
      setSelectedFiles([]);
      setState({
        kind: "error",
        message: `${invalidType.name} is not a supported image format`,
      });
      return;
    }

    const oversizedFile = files.find(
      (file) => file.size > MAX_UPLOAD_SIZE_BYTES,
    );

    if (oversizedFile) {
      setSelectedFiles([]);
      setState({
        kind: "error",
        message: `${oversizedFile.name} must be ${MAX_UPLOAD_SIZE_MB} MB or smaller`,
      });
      return;
    }

    setSelectedFiles(files);
    setUploadedCount(0);
    setState({ kind: "idle", message: "" });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFileSelection(event.target.files ?? []);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (
      !(event.relatedTarget instanceof Node) ||
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFileSelection(event.dataTransfer.files);
  }

  async function uploadToS3(file: File, upload: JobUpload): Promise<void> {
    const formData = new FormData();

    for (const [key, value] of Object.entries(upload.fields)) {
      formData.append(key, value);
    }
    formData.append("file", file);

    const response = await fetch(upload.url, {
      body: formData,
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(
        `S3 upload failed with status ${response.status} (${response.statusText})`,
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (selectedFiles.length === 0) {
      setState({ kind: "error", message: "Please select at least one image" });
      return;
    }

    setIsUploading(true);
    setUploadedCount(0);
    setState({ kind: "idle", message: "Creating job…" });

    try {
      const createJobResponse = await fetch("/api/jobs", {
        body: JSON.stringify({
          photos: selectedFiles.map((file) => ({
            contentType: file.type,
            fileName: file.name,
            size: file.size,
          })),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const createJobResult = (await createJobResponse.json()) as CreateJobResponse;

      if (
        !createJobResponse.ok ||
        !createJobResult.jobId ||
        !createJobResult.uploads ||
        createJobResult.uploads.length !== selectedFiles.length
      ) {
        throw new Error(
          createJobResult.message ??
            `Job creation failed with status ${createJobResponse.status}`,
        );
      }

      for (const [index, file] of selectedFiles.entries()) {
        const upload = createJobResult.uploads[index];

        if (!upload) {
          throw new Error(`No upload target was created for ${file.name}`);
        }

        setState({
          kind: "idle",
          message: `Uploading ${index + 1} of ${selectedFiles.length}…`,
        });
        await uploadToS3(file, upload);
        setUploadedCount((count) => count + 1);
      }

      setState({ kind: "idle", message: "Putting job in the queue…" });
      const startResponse = await fetch(
        `/api/jobs/${createJobResult.jobId}/start`,
        { method: "POST" },
      );
      const startResult = (await startResponse.json()) as {
        message?: string;
      };

      if (!startResponse.ok) {
        throw new Error(
          startResult.message ??
            `The job could not be started (${startResponse.status})`,
        );
      }

      setState({
        kind: "success",
        jobId: createJobResult.jobId,
        message: "Photos uploaded. The enhancement job is queued.",
      });
      setSelectedFiles([]);
      setUploadedCount(0);
      form.reset();
      window.dispatchEvent(new Event("photo-enhancer:jobs-changed"));
    } catch (error) {
      setState({
        kind: "error",
        message: getErrorMessage(error, "The photos could not be uploaded"),
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <label
        className={`flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition hover:border-zinc-500 hover:bg-zinc-100 ${
          isDragging
            ? "border-zinc-950 bg-zinc-100"
            : "border-zinc-300 bg-zinc-50"
        }`}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        htmlFor="image-file"
      >
        <span className="mb-3 text-4xl" aria-hidden="true">
          ↑
        </span>
        <span className="font-medium text-zinc-900">
          {selectedFiles.length > 0
            ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} selected`
            : "Choose photos to enhance"}
        </span>
        <span className="mt-2 text-sm text-zinc-500">
          Drag and drop up to {MAX_PHOTOS_PER_JOB} images, or select files
        </span>
        <input
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="sr-only"
          id="image-file"
          multiple
          name="file"
          onChange={handleFileChange}
          type="file"
        />
      </label>

      {selectedFiles.length > 0 && (
        <ul className="space-y-1 text-sm text-zinc-600">
          {selectedFiles.map((file) => (
            <li className="truncate" key={`${file.name}-${file.size}`}>
              {file.name}
            </li>
          ))}
        </ul>
      )}

      <button
        className="flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        disabled={isUploading}
        type="submit"
      >
        {isUploading
          ? uploadedCount > 0
            ? `Uploading ${uploadedCount}/${selectedFiles.length}…`
            : "Starting upload…"
          : selectedFiles.length > 0
            ? `Upload ${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"}`
            : "Upload photos"}
      </button>

      <div aria-live="polite" className="min-h-6 text-sm">
        {state.kind === "success" && (
          <p className="text-emerald-700">
            {state.message} Job ID: <code>{state.jobId}</code>
          </p>
        )}
        {state.kind === "error" && <p className="text-red-600">{state.message}</p>}
        {state.kind === "idle" && state.message && (
          <p className="text-zinc-500">{state.message}</p>
        )}
      </div>
    </form>
  );
}
