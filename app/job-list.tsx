"use client";

import { useEffect, useState } from "react";

type JobSummary = {
  completedPhotos: number;
  createdAt: string;
  failedPhotos: number;
  jobId: string;
  status: string;
  totalPhotos: number;
};

type JobsResponse = {
  jobs?: JobSummary[];
  message?: string;
};

async function fetchJobs(): Promise<JobSummary[]> {
  const response = await fetch("/api/jobs", { cache: "no-store" });
  const result = (await response.json()) as JobsResponse;

  if (!response.ok) {
    throw new Error(result.message ?? "The jobs could not be loaded");
  }

  return result.jobs ?? [];
}

export function JobList() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadJobs() {
      try {
        const nextJobs = await fetchJobs();

        if (isMounted) {
          setJobs(nextJobs);
          setError("");
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The jobs could not be loaded",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadJobs();
    const interval = window.setInterval(loadJobs, 5000);
    const refreshEvent = () => loadJobs();

    window.addEventListener("photo-enhancer:jobs-changed", refreshEvent);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener("photo-enhancer:jobs-changed", refreshEvent);
    };
  }, []);

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Loading jobs…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-zinc-500">No jobs yet.</p>;
  }

  return (
    <section className="space-y-3" aria-labelledby="jobs-heading">
      <div className="flex items-center justify-between">
        <h2 id="jobs-heading" className="text-sm font-semibold text-zinc-900">
          Your jobs
        </h2>
        <span className="text-xs text-zinc-400">Updates automatically</span>
      </div>
      <ul className="space-y-2">
        {jobs.map((job) => {
          const processedPhotos = job.completedPhotos + job.failedPhotos;
          const progress = Math.round(
            (processedPhotos / Math.max(job.totalPhotos, 1)) * 100,
          );

          return (
            <li
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
              key={job.jobId}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-zinc-500">
                    {job.jobId}
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">
                    {job.status}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-zinc-600">
                  {processedPhotos}/{job.totalPhotos}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-zinc-900 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {new Date(job.createdAt).toLocaleString()}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
