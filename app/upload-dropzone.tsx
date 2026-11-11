"use client";

import type {
  ChangeEventHandler,
  DragEventHandler,
  RefObject,
} from "react";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTOS_PER_JOB,
} from "@/lib/upload-constants";
import type { FilePreview } from "@/app/upload-types";

type UploadDropzoneProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  isUploading: boolean;
  onDragEnter: DragEventHandler<HTMLLabelElement>;
  onDragLeave: DragEventHandler<HTMLLabelElement>;
  onDragOver: DragEventHandler<HTMLLabelElement>;
  onDrop: DragEventHandler<HTMLLabelElement>;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  onRemove: (index: number) => void;
  previews: FilePreview[];
  selectedFiles: File[];
};

export function UploadDropzone({
  fileInputRef,
  isDragging,
  isUploading,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileChange,
  onRemove,
  previews,
  selectedFiles,
}: UploadDropzoneProps) {
  return (
    <label
      className={`flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition hover:border-zinc-500 hover:bg-zinc-100 ${
        isDragging
          ? "border-zinc-950 bg-zinc-100"
          : "border-zinc-300 bg-zinc-50"
      }`}
      htmlFor="image-file"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {selectedFiles.length > 0 ? (
        <>
          <span className="mb-4 font-medium text-zinc-900">
            {selectedFiles.length} photo
            {selectedFiles.length === 1 ? "" : "s"} selected
          </span>
          <span className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
            {selectedFiles.map((file, index) => {
              const preview = previews.find((item) => item.file === file);

              return (
                <span
                  className="relative aspect-square overflow-hidden rounded-xl bg-zinc-200"
                  key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                >
                  {preview && (
                    // Local object URLs are created in the browser for files that have not been uploaded yet.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={file.name}
                      className="h-full w-full object-cover"
                      src={preview.url}
                    />
                  )}
                  <button
                    aria-label={`Remove ${file.name}`}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950/80 text-lg leading-none text-white shadow-sm transition hover:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isUploading}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemove(index);
                    }}
                    type="button"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </span>
              );
            })}
          </span>
          <span className="mt-4 text-sm text-zinc-500">
            Choose different files to replace this selection
          </span>
        </>
      ) : (
        <>
          <span className="mb-3 text-4xl" aria-hidden="true">
            ↑
          </span>
          <span className="font-medium text-zinc-900">
            Choose photos to enhance
          </span>
          <span className="mt-2 text-sm text-zinc-500">
            Drag and drop up to {MAX_PHOTOS_PER_JOB} images, or select files
          </span>
        </>
      )}
      <input
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        className="sr-only"
        id="image-file"
        multiple
        name="file"
        onChange={onFileChange}
        ref={fileInputRef}
        type="file"
      />
    </label>
  );
}
