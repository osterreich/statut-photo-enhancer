import { UploadForm } from "@/app/upload-form";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl shadow-zinc-200/60 sm:p-12">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Photo enhancer
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950">
            Upload your image
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">
            Select an image and we&apos;ll save it to S3. Enhancement will come
            next.
          </p>
        </div>
        <UploadForm />
      </section>
    </main>
  );
}
