"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";

type FileKind = "pdf" | "docx";
type OutputFormat = "docx" | "pdf";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"] as const;

function getFileKind(fileName: string): FileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  return null;
}

function filenameFromDisposition(
  header: string | null,
  fallback: string,
): string {
  if (!header) return fallback;

  const utf8Name = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Name?.[1]) {
    try {
      return decodeURIComponent(utf8Name[1]);
    } catch {
      // Usa el fallback de filename= si el encoding falla.
    }
  }

  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];

  const plain = header.match(/filename=([^;]+)/i);
  if (plain?.[1]) return plain[1].trim().replaceAll('"', "");

  return fallback;
}

function PdfIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8 shrink-0 text-red-600"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L18.5 9H15zM8.5 17.5c0 .8-.4 1.2-1.1 1.2-.3 0-.6-.1-.8-.2l.2-1c.1.1.3.1.5.1.2 0 .3-.1.3-.3 0-.5-.9-.4-.9-1.3 0-.7.4-1.2 1.1-1.2.3 0 .6.1.8.2l-.2 1c-.1 0-.3-.1-.5-.1-.2 0-.3.1-.3.3 0 .5.9.4.9 1.3zm4.1-2.8c.8 0 1.4.6 1.4 1.5v1.1c0 .9-.6 1.5-1.4 1.5h-1.3v-4.1h1.3zm-.4 3.2h.3c.3 0 .6-.2.6-.7v-1c0-.5-.2-.7-.6-.7h-.3v2.4zM16 13.2h1.7v1h-1.7V16h-1v-4.1H18v1h-2v.3z" />
    </svg>
  );
}

function WordIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8 shrink-0 text-blue-600"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L18.5 9H15zM7.2 12.2l1.5 6.3h1.3l1.1-4.3c.1-.3.1-.6.2-.9h.1c0 .3.1.6.2.9l1.1 4.3h1.3l1.6-6.3h-1.3l-.8 4.1c-.1.4-.1.7-.2 1.1h-.1c0-.3-.1-.7-.2-1.1l-1.1-4.1h-1.1l-1.1 4.1c-.1.4-.1.7-.2 1.1h-.1c0-.3-.1-.7-.2-1.1l-.8-4.1H7.2z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function FileDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<FileKind | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("docx");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyFile(selected: File) {
    const kind = getFileKind(selected.name);
    if (!kind) {
      setFile(null);
      setFileKind(null);
      setSuccess(null);
      setError(
        `Archivo no válido. Solo se aceptan ${ACCEPTED_EXTENSIONS.join(" y ")}.`,
      );
      return;
    }

    setFile(selected);
    setFileKind(kind);
    setSuccess(null);
    setError(null);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) applyFile(dropped);
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) applyFile(selected);
    event.target.value = "";
  }

  async function handleConvert() {
    if (!file || loading) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("outputFormat", outputFormat);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "La conversión falló. Inténtalo de nuevo.";
        try {
          const payload: unknown = await response.json();
          if (
            payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof payload.error === "string"
          ) {
            message = payload.error;
          }
        } catch {
          // Conserva el mensaje genérico si el cuerpo no es JSON.
        }
        setError(message);
        return;
      }

      const blob = await response.blob();
      const fallback = `documentacion-api.${outputFormat}`;
      const filename = filenameFromDisposition(
        response.headers.get("Content-Disposition"),
        fallback,
      );
      downloadBlob(blob, filename);
      setSuccess("Documento generado y descargado correctamente");
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "La conversión falló. Inténtalo de nuevo.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const canConvert = Boolean(file) && !loading;

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={handleInputChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={loading}
        className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors ${
          isDragging
            ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
            : "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
        } ${loading ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500"}`}
      >
        {file && fileKind ? (
          <div className="flex items-center gap-3">
            {fileKind === "pdf" ? <PdfIcon /> : <WordIcon />}
            <div className="text-left">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {file.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {fileKind === "pdf" ? "Documento PDF" : "Documento Word"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-lg font-medium text-zinc-700 dark:text-zinc-200">
              Arrastra y suelta tu archivo aquí
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              o haz clic para seleccionar un .pdf o .docx
            </p>
          </>
        )}
      </button>

      {file ? (
        <fieldset className="w-full">
          <legend className="mb-2 text-center text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Formato de salida
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                outputFormat === "docx"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              <input
                type="radio"
                name="outputFormat"
                value="docx"
                checked={outputFormat === "docx"}
                onChange={() => setOutputFormat("docx")}
                className="sr-only"
              />
              Word
            </label>
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                outputFormat === "pdf"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              <input
                type="radio"
                name="outputFormat"
                value="pdf"
                checked={outputFormat === "pdf"}
                onChange={() => setOutputFormat("pdf")}
                className="sr-only"
              />
              PDF
            </label>
          </div>
        </fieldset>
      ) : null}

      <button
        type="button"
        onClick={handleConvert}
        disabled={!canConvert}
        className="inline-flex h-11 min-w-40 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
      >
        {loading ? (
          <>
            <Spinner />
            Procesando...
          </>
        ) : (
          "Convertir"
        )}
      </button>

      {error ? (
        <p
          role="alert"
          className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          role="status"
          className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
        >
          {success}
        </p>
      ) : null}
    </div>
  );
}
