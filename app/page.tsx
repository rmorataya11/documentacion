import FileDropzone from "@/app/components/FileDropzone";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 flex-col items-center px-6 py-12 md:px-10 md:py-16">
        <section className="mb-12 w-full max-w-4xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Conversor de Documentación API
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-text-soft md:text-lg">
            Convierte tu documentación técnica al formato estándar de Davivienda,
            en Word o PDF
          </p>
        </section>

        <FileDropzone />
      </main>
    </div>
  );
}
