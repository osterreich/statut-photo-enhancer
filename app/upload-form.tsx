"use client";

import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { UploadDropzone } from "@/app/upload-dropzone";
import { UploadButton, UploadFeedback } from "@/app/upload-controls";
import type {
  CreateJobResponse,
  FilePreview,
  JobUpload,
  UploadState,
} from "@/app/upload-types";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTOS_PER_JOB,
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
} from "@/lib/upload-constants";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function UploadForm() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<FilePreview[]>([]);
  const [state, setState] = useState<UploadState>({
    kind: "idle",
    message: "",
  });

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, []);

  function clearPreviews() {
    previewUrlsRef.current.forEach(({ url }) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setPreviews([]);
  }

  function replaceSelectedFiles(files: File[]) {
    clearPreviews();

    const nextPreviews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    previewUrlsRef.current = nextPreviews;
    setPreviews(nextPreviews);
    setSelectedFiles(files);
  }

  function handleFileSelection(fileList: FileList | File[]) {
    const files = Array.from(fileList);

    if (files.length === 0) {
      return;
    }

    if (files.length > MAX_PHOTOS_PER_JOB) {
      clearPreviews();
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
      clearPreviews();
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
      clearPreviews();
      setSelectedFiles([]);
      setState({
        kind: "error",
        message: `${oversizedFile.name} must be ${MAX_UPLOAD_SIZE_MB} MB or smaller`,
      });
      return;
    }

    replaceSelectedFiles(files);
    setUploadedCount(0);
    setState({ kind: "idle", message: "" });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFileSelection(event.target.files ?? []);
  }

  function removeFile(indexToRemove: number) {
    const fileToRemove = selectedFiles[indexToRemove];

    if (fileToRemove) {
      const previewToRemove = previewUrlsRef.current.find(
        ({ file }) => file === fileToRemove,
      );

      if (previewToRemove) {
        URL.revokeObjectURL(previewToRemove.url);
      }

      previewUrlsRef.current = previewUrlsRef.current.filter(
        ({ file }) => file !== fileToRemove,
      );
      setPreviews((currentPreviews) =>
        currentPreviews.filter(({ file }) => file !== fileToRemove),
      );
    }

    setSelectedFiles((files) =>
      files.filter((_, index) => index !== indexToRemove),
    );
    setState({ kind: "idle", message: "" });

    // Allow selecting the same file again after removing it.
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      clearPreviews();
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
      <UploadDropzone
        fileInputRef={fileInputRef}
        isDragging={isDragging}
        isUploading={isUploading}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onFileChange={handleFileChange}
        onRemove={removeFile}
        previews={previews}
        selectedFiles={selectedFiles}
      />

      <UploadButton
        isUploading={isUploading}
        selectedCount={selectedFiles.length}
        uploadedCount={uploadedCount}
      />

      <UploadFeedback state={state} />
    </form>
  );
}
