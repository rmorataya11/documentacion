"use client";

import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CloudUpload,
  Download,
  FileText,
  RefreshCw,
} from "lucide-react";
import ProgressSteps from "@/app/components/ProgressSteps";

type FileKind = "pdf" | "docx";
type OutputFormat = "docx" | "pdf";
type View = "idle" | "processing" | "success" | "error";
type Step = 1 | 2 | 3 | 4;

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

const panelTransition = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.28 },
};

export default function FileDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<FileKind | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("docx");
  const [isDragging, setIsDragging] = useState(false);
  const [view, setView] = useState<View>("idle");
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedName, setGeneratedName] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function applyFile(selected: File) {
    const kind = getFileKind(selected.name);
    if (!kind) {
      setFile(null);
      setFileKind(null);
      setGeneratedBlob(null);
      setGeneratedName(null);
      setError(
        `Archivo no válido. Solo se aceptan ${ACCEPTED_EXTENSIONS.join(" y ")}.`,
      );
      setView("idle");
      return;
    }

    setFile(selected);
    setFileKind(kind);
    setError(null);
    setGeneratedBlob(null);
    setGeneratedName(null);
    setView("idle");
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

  function resetToIdleKeepFile() {
    clearTimers();
    setView("idle");
    setCurrentStep(1);
    setError(null);
  }

  function resetAll() {
    clearTimers();
    setFile(null);
    setFileKind(null);
    setOutputFormat("docx");
    setView("idle");
    setCurrentStep(1);
    setError(null);
    setGeneratedBlob(null);
    setGeneratedName(null);
    setIsDragging(false);
  }

  async function handleConvert() {
    if (!file || view === "processing") return;

    clearTimers();
    setError(null);
    setGeneratedBlob(null);
    setGeneratedName(null);
    setView("processing");
    setCurrentStep(1);

    timersRef.current.push(
      window.setTimeout(() => setCurrentStep(2), 900),
      window.setTimeout(() => setCurrentStep(3), 8000),
    );

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
        clearTimers();
        setError(message);
        setView("error");
        return;
      }

      const blob = await response.blob();
      const fallback = `documentacion-api.${outputFormat}`;
      const filename = filenameFromDisposition(
        response.headers.get("Content-Disposition"),
        fallback,
      );
      clearTimers();
      setGeneratedBlob(blob);
      setGeneratedName(filename);
      setCurrentStep(4);
      downloadBlob(blob, filename);
      timersRef.current.push(
        window.setTimeout(() => setView("success"), 700),
      );
    } catch (caught) {
      clearTimers();
      const message =
        caught instanceof Error
          ? caught.message
          : "La conversión falló. Inténtalo de nuevo.";
      setError(message);
      setView("error");
    }
  }

  const canConvert = Boolean(file) && view !== "processing";

  return (
    <div className="flex w-full max-w-3xl flex-col items-center">
      <AnimatePresence mode="wait">
        {view === "idle" ? (
          <motion.div
            key="idle"
            {...panelTransition}
            className="flex w-full flex-col items-center gap-6"
          >
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
              className={`flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 text-center transition-all duration-200 ${
                isDragging
                  ? "border-accent bg-accent/10 shadow-[0_0_0_6px_rgba(225,37,27,0.16)]"
                  : "border-white/20 bg-white/5 hover:border-accent hover:bg-accent/5"
              }`}
            >
              {file && fileKind ? (
                <div className="flex items-center gap-4">
                  <FileText className="h-12 w-12 text-accent" />
                  <div className="text-left">
                    <p className="text-lg font-medium text-white">{file.name}</p>
                    <p className="mt-1 text-sm text-text-soft">
                      {fileKind === "pdf" ? "Documento PDF" : "Documento Word"}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <CloudUpload
                    className={`mb-5 h-16 w-16 ${isDragging ? "text-accent" : "text-text-soft"}`}
                  />
                  <p className="text-xl font-medium text-white">
                    Arrastra y suelta tu archivo aquí
                  </p>
                  <p className="mt-2 text-sm text-text-soft">
                    o haz clic para seleccionar un .pdf o .docx
                  </p>
                </>
              )}
            </button>

            {file ? (
              <fieldset className="w-full">
                <legend className="mb-3 text-center text-sm font-medium text-text-soft">
                  Formato de salida
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      outputFormat === "docx"
                        ? "border-accent bg-accent text-white"
                        : "border-white/15 bg-white/5 text-white hover:border-accent/70"
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
                    className={`flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      outputFormat === "pdf"
                        ? "border-accent bg-accent text-white"
                        : "border-white/15 bg-white/5 text-white hover:border-accent/70"
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
              className="inline-flex h-12 min-w-48 items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-text-muted"
            >
              Convertir
            </button>

            {error && !file ? (
              <p role="alert" className="w-full text-center text-sm text-accent">
                {error}
              </p>
            ) : null}
          </motion.div>
        ) : null}

        {view === "processing" ? (
          <motion.div
            key="processing"
            {...panelTransition}
            className="flex w-full flex-col items-center py-8"
          >
            <ProgressSteps currentStep={currentStep} />
          </motion.div>
        ) : null}

        {view === "success" ? (
          <motion.div
            key="success"
            {...panelTransition}
            className="flex w-full max-w-lg flex-col items-center rounded-2xl border border-white/10 bg-white/5 px-8 py-10 text-center"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: "rgba(46, 204, 113, 0.12)",
                color: "var(--accent-success)",
              }}
            >
              <motion.span
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
              >
                <Check className="h-10 w-10" strokeWidth={2.75} />
              </motion.span>
            </motion.div>
            <h2 className="text-2xl font-semibold text-white">Documento listo</h2>
            <p className="mt-2 text-sm text-text-soft">
              {generatedName ?? "El archivo se descargó correctamente."}
            </p>
            <button
              type="button"
              onClick={() => {
                if (generatedBlob && generatedName) {
                  downloadBlob(generatedBlob, generatedName);
                }
              }}
              className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
            >
              <Download className="h-4 w-4" />
              Descargar de nuevo
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-transparent px-6 text-sm font-medium text-white transition-colors hover:border-white/30"
            >
              <RefreshCw className="h-4 w-4" />
              Convertir otro documento
            </button>
          </motion.div>
        ) : null}

        {view === "error" ? (
          <motion.div
            key="error"
            {...panelTransition}
            role="alert"
            className="flex w-full max-w-lg flex-col items-center rounded-2xl border border-accent/40 bg-accent/10 px-8 py-10 text-center"
          >
            <AlertTriangle className="mb-5 h-12 w-12 text-accent" />
            <h2 className="text-xl font-semibold text-white">
              No se pudo procesar el documento
            </h2>
            <p className="mt-3 text-sm leading-6 text-text-soft">
              {error ?? "Inténtalo de nuevo."}
            </p>
            <button
              type="button"
              onClick={resetToIdleKeepFile}
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
            >
              Intentar de nuevo
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
