import type { UploadState } from "@/app/upload-types";

type UploadButtonProps = {
  isUploading: boolean;
  selectedCount: number;
  uploadedCount: number;
};

export function UploadButton({
  isUploading,
  selectedCount,
  uploadedCount,
}: UploadButtonProps) {
  return (
    <button
      className="flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
      disabled={isUploading}
      type="submit"
    >
      {isUploading
        ? uploadedCount > 0
          ? `Uploading ${uploadedCount}/${selectedCount}…`
          : "Starting upload…"
        : selectedCount > 0
          ? `Upload ${selectedCount} photo${selectedCount === 1 ? "" : "s"}`
          : "Upload photos"}
    </button>
  );
}

type UploadFeedbackProps = {
  state: UploadState;
};

export function UploadFeedback({ state }: UploadFeedbackProps) {
  return (
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
  );
}
