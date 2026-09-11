export default function FileDropzone() {
  return (
    <div className="flex w-full max-w-xl flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-8 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-lg font-medium text-zinc-700 dark:text-zinc-200">
        Arrastra y suelta tu archivo aquí
      </p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Componente placeholder — la carga de archivos se implementará más adelante
      </p>
    </div>
  );
}
