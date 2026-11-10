"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";

type UploadState =
  | { kind: "idle"; message: string }
  | { kind: "success"; message: string; key: string }
  | { kind: "error"; message: string };

export function UploadForm() {
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [state, setState] = useState<UploadState>({
    kind: "idle",
    message: "",
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setSelectedFileName(file?.name ?? "");
    setState({ kind: "idle", message: "" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setIsUploading(true);
    setState({ kind: "idle", message: "" });

    try {
      const response = await fetch("/api/upload", {
        body: formData,
        method: "POST",
      });
      const result = (await response.json()) as {
        key?: string;
        message?: string;
      };

      if (!response.ok || !result.key) {
        throw new Error(result.message ?? "The image could not be uploaded");
      }

      setState({
        kind: "success",
        key: result.key,
        message: "Image uploaded successfully",
      });
      form.reset();
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
        className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center transition hover:border-zinc-500 hover:bg-zinc-100"
        htmlFor="image-file"
      >
        <span className="mb-3 text-4xl" aria-hidden="true">
          ↑
        </span>
        <span className="font-medium text-zinc-900">
          {selectedFileName || "Choose an image to upload"}
        </span>
        <span className="mt-2 text-sm text-zinc-500">
          Select an image file
        </span>
        <input
          accept="image/*"
          className="sr-only"
          id="image-file"
          name="file"
          onChange={handleFileChange}
          required
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
