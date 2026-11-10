"use client";

import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useState } from "react";

import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
} from "@/lib/upload-constants";

type UploadState =
  | { kind: "idle"; message: string }
  | { kind: "success"; message: string; key: string }
  | { kind: "error"; message: string };

export function UploadForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [state, setState] = useState<UploadState>({
    kind: "idle",
    message: "",
  });

  function handleFileSelection(file: File | undefined) {
    if (file && file.size > MAX_UPLOAD_SIZE_BYTES) {
      setSelectedFile(null);
      setSelectedFileName("");
      setState({
        kind: "error",
        message: `Image must be ${MAX_UPLOAD_SIZE_MB} MB or smaller`,
      });
      return;
    }

    setSelectedFile(file ?? null);
    setSelectedFileName(file?.name ?? "");
    setState({ kind: "idle", message: "" });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFileSelection(event.target.files?.[0]);
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
    handleFileSelection(event.dataTransfer.files[0]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!selectedFile) {
      setState({ kind: "error", message: "Please select an image file" });
      return;
    }

    setIsUploading(true);
    setState({ kind: "idle", message: "" });

    try {
      const presignResponse = await fetch("/api/upload", {
        body: JSON.stringify({
          contentType: selectedFile.type,
          fileName: selectedFile.name,
          size: selectedFile.size,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const presignText = await presignResponse.text();
      const presignResult = presignText
        ? (JSON.parse(presignText) as {
            fields?: Record<string, string>;
            key?: string;
            message?: string;
            url?: string;
          })
        : {};

      if (
        !presignResponse.ok ||
        !presignResult.url ||
        !presignResult.fields ||
        !presignResult.key
      ) {
        throw new Error(
          presignResult.message ??
            `Upload failed with status ${presignResponse.status} (${presignResponse.statusText})`,
        );
      }

      const uploadFormData = new FormData();

      for (const [key, value] of Object.entries(presignResult.fields)) {
        uploadFormData.append(key, value);
      }
      uploadFormData.append("file", selectedFile);

      const uploadResponse = await fetch(presignResult.url, {
        body: uploadFormData,
        method: "POST",
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `S3 upload failed with status ${uploadResponse.status} (${uploadResponse.statusText})`,
        );
      }

      setState({
        kind: "success",
        key: presignResult.key,
        message: "Image uploaded successfully",
      });
      form.reset();
      setSelectedFile(null);
      setSelectedFileName("");
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The image could not be uploaded",
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
          {selectedFileName || "Choose an image to upload"}
        </span>
        <span className="mt-2 text-sm text-zinc-500">
          Drag and drop an image here, or select a file
        </span>
        <input
          accept="image/*"
          className="sr-only"
          id="image-file"
          name="file"
          onChange={handleFileChange}
          type="file"
        />
      </label>

      <button
        className="flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        disabled={isUploading}
        type="submit"
      >
        {isUploading ? "Uploading…" : "Upload image"}
      </button>

      <div aria-live="polite" className="min-h-6 text-sm">
        {state.kind === "success" && (
          <p className="text-emerald-700">
            {state.message}. S3 key: <code>{state.key}</code>
          </p>
        )}
        {state.kind === "error" && <p className="text-red-600">{state.message}</p>}
      </div>
    </form>
  );
}
