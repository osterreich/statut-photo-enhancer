export type UploadState =
  | { kind: "idle"; message: string }
  | { kind: "success"; jobId: string; message: string }
  | { kind: "error"; message: string };

export type JobUpload = {
  contentType: string;
  fields: Record<string, string>;
  fileName: string;
  key: string;
  photoId: string;
  size: number;
  url: string;
};

export type CreateJobResponse = {
  jobId?: string;
  message?: string;
  uploads?: JobUpload[];
};

export type FilePreview = {
  file: File;
  url: string;
};
