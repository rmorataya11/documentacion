"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, FileText, Sparkles, Upload } from "lucide-react";

const STEPS = [
  { id: 1, label: "Subiendo archivo", Icon: Upload },
  { id: 2, label: "Analizando con IA", Icon: Sparkles },
  { id: 3, label: "Generando documento", Icon: FileText },
  { id: 4, label: "Listo", Icon: Check },
] as const;

const ANALYZING_MESSAGES = [
  "Esto puede tardar unos segundos si el servicio de IA está saturado",
  "Extrayendo estructura y endpoints del documento",
  "Si hay alta demanda, reintentaremos automáticamente",
];

type ProgressStepsProps = {
  currentStep: 1 | 2 | 3 | 4;
};

export default function ProgressSteps({ currentStep }: ProgressStepsProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (currentStep !== 2) {
      setMessageIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setMessageIndex((index) => (index + 1) % ANALYZING_MESSAGES.length);
    }, 3500);

    return () => clearInterval(timer);
  }, [currentStep]);

  return (
    <div className="w-full max-w-3xl">
      <ol className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {STEPS.map(({ id, label, Icon }, index) => {
          const completed = currentStep > id;
          const active = currentStep === id;

          return (
            <li key={id} className="flex flex-col items-center text-center">
              <div className="relative mb-3 flex items-center justify-center">
                {index < STEPS.length - 1 ? (
                  <span
                    className="absolute top-1/2 left-[calc(50%+28px)] hidden h-px w-[calc(100%+1.5rem)] md:block"
                    style={{
                      background: completed || currentStep > id ? "var(--accent)" : "rgba(255,255,255,0.12)",
                    }}
                    aria-hidden="true"
                  />
                ) : null}

                <motion.div
                  animate={
                    active
                      ? { scale: [1, 1.08, 1], boxShadow: ["0 0 0 0 rgba(225,37,27,0.5)", "0 0 0 10px rgba(225,37,27,0)", "0 0 0 0 rgba(225,37,27,0)"] }
                      : { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
                  }
                  transition={
                    active
                      ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.25 }
                  }
                  className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: completed
                      ? "var(--accent-success)"
                      : active
                        ? "var(--accent)"
                        : "var(--text-muted)",
                    background: completed
                      ? "rgba(46, 204, 113, 0.12)"
                      : active
                        ? "rgba(225, 37, 27, 0.12)"
                        : "transparent",
                    color: completed
                      ? "var(--accent-success)"
                      : active
                        ? "var(--accent)"
                        : "var(--text-muted)",
                  }}
                >
                  {completed ? (
                    <Check className="h-6 w-6" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </motion.div>
              </div>
              <p
                className="text-sm font-medium"
                style={{
                  color: completed
                    ? "var(--accent-success)"
                    : active
                      ? "#ffffff"
                      : "var(--text-muted)",
                }}
              >
                {label}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="mt-10 min-h-12 overflow-hidden text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={`${currentStep}-${messageIndex}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.28 }}
            className="text-sm text-text-soft"
          >
            {currentStep === 2
              ? ANALYZING_MESSAGES[messageIndex]
              : currentStep === 1
                ? "Preparando el archivo para el análisis"
                : currentStep === 3
                  ? "Armando el documento con el formato de marca"
                  : "Conversión finalizada"}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
