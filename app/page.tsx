import FileDropzone from "@/app/components/FileDropzone";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center px-6 py-16">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Conversor de Documentación API
        </h1>
        <FileDropzone />
      </main>
    </div>
  );
}
