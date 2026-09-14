import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import { NextResponse } from "next/server";
import { generatePdfDocument } from "@/lib/generators/pdf-generator";
import { generateWordDocument } from "@/lib/generators/word-generator";
import type { ApiDocSchema } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `Eres un asistente que extrae y estructura documentación técnica de APIs. Extrae la información del documento y organízala siguiendo exactamente esta estructura: overview general del API; capacidades/funcionalidades principales si el documento las lista (viñetas o una sección separada del overview); mecanismo de seguridad/autenticación si se menciona; nota de formato estándar de errores si existe; y luego cada endpoint en el orden en que aparecen en el documento original, incluyendo para cada uno: número de sección, título, método HTTP, ruta, descripción, headers requeridos, parámetros de path, parámetros de query, ejemplo de request body si aplica, respuesta con status code y ejemplo, campos de la respuesta, y errores posibles. Si una sección opcional no está presente en el documento, omítela o déjala como array vacío — no inventes contenido que no esté en el documento original. Devuelve únicamente el JSON, sin texto adicional ni explicaciones.

Reglas para campos nuevos:
- capabilities: si el documento describe una lista de funcionalidades o capacidades del API, extráelas como array de strings. Si no hay una sección así, omite el campo o déjalo como array vacío.
- security: si el documento menciona el mecanismo de autenticación/seguridad (headers de autorización, tipo de token, mTLS, API keys, OAuth, etc.), extrae "mechanism" (nombre corto) y "description" (cómo funciona). Si no se menciona explícitamente, omite el campo.
- constraint: si la descripción original de un path param, query param o campo de respuesta menciona una restricción de longitud, formato o rango (ej: "máximo 50 caracteres", "formato yyyy-MM-dd", "entre 1 y 100"), extráela por separado en "constraint" y no la dejes solo mezclada en "description". Si no hay restricción mencionada, omite "constraint".
- No inventes información de seguridad, capacidades o restricciones que no estén presentes en el documento original — si no se menciona, omite el campo.

Revisión de nomenclatura (después de extraer todos los endpoints y sus campos pathParams, queryParams, requestHeaders y responseFields):
- Evalúa si los nombres de esos campos siguen las convenciones de nomenclatura de los estándares BIAN e ISO 20022 (por ejemplo: camelCase versus los estilos típicos de estos estándares, uso de términos estandarizados como "Dbtr", "Cdtr", abreviaciones ISO 20022, dominios de servicio BIAN, etc.).
- Esta evaluación es sobre convención de nombres (naming), no sobre la lógica de negocio del API. Determina un veredicto general (cumple/parcial/no_cumple) y escribe un resumen breve de 2-3 oraciones explicando por qué. Si hay un patrón relevante (por ejemplo, camelCase genérico en lugar de abreviaciones ISO), menciónalo de forma narrativa dentro del resumen; no generes una lista estructurada de campos ni sugerencias de corrección por campo.
- Si no tienes suficiente certeza para evaluar esto con los datos disponibles, indica "parcial" con una nota explicando la incertidumbre, en vez de forzar un veredicto categórico.

El JSON debe seguir exactamente esta forma:
{
  "title": string,
  "subtitle": string,
  "version": string,
  "overview": string,
  "capabilities": [string],
  "security": { "mechanism": string, "description": string },
  "errorFormatNote": { "description": string, "example": string },
  "namingConventionReview": {
    "overallAssessment": "cumple" | "parcial" | "no_cumple",
    "summary": string
  },
  "endpoints": [
    {
      "sectionNumber": string,
      "title": string,
      "method": string,
      "path": string,
      "description": string,
      "requestHeaders": [{ "name": string, "required": boolean, "description": string }],
      "pathParams": [{ "name": string, "type": string, "required": boolean, "constraint": string, "description": string }],
      "queryParams": [{ "name": string, "type": string, "required": boolean, "constraint": string, "description": string }],
      "requestBodyExample": string,
      "response": { "statusCode": string, "example": string },
      "responseFields": [{ "name": string, "type": string, "constraint": string, "description": string }],
      "errors": [{ "code": string, "description": string, "body": string }]
    }
  ]
}`;

type FileKind = "pdf" | "docx";
type OutputFormat = "docx" | "pdf";

function getOutputFormat(value: FormDataEntryValue | null): OutputFormat | null {
  return value === "docx" || value === "pdf" ? value : null;
}

function sanitizeFilename(title: string): string {
  const cleaned = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned.length > 0 ? cleaned : "documentacion-api";
}

function fileResponse(buffer: Buffer, format: OutputFormat, title: string) {
  const filename = `${sanitizeFilename(title)}.${format}`;
  const contentType =
    format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function getFileKind(file: File): FileKind | null {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  if (name.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (
    name.endsWith(".docx") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isApiDocSchema(value: unknown): value is ApiDocSchema {
  if (!isRecord(value)) return false;
  if (typeof value.title !== "string") return false;
  if (typeof value.subtitle !== "string") return false;
  if (typeof value.version !== "string") return false;
  if (typeof value.overview !== "string") return false;
  if (value.capabilities !== undefined && !Array.isArray(value.capabilities)) {
    return false;
  }
  if (value.security !== undefined) {
    if (
      !isRecord(value.security) ||
      typeof value.security.mechanism !== "string" ||
      typeof value.security.description !== "string"
    ) {
      return false;
    }
  }
  if (value.namingConventionReview !== undefined) {
    if (!isRecord(value.namingConventionReview)) return false;
    const assessment = value.namingConventionReview.overallAssessment;
    if (
      assessment !== "cumple" &&
      assessment !== "parcial" &&
      assessment !== "no_cumple"
    ) {
      return false;
    }
    if (typeof value.namingConventionReview.summary !== "string") return false;
  }
  if (!Array.isArray(value.endpoints)) return false;

  return value.endpoints.every((endpoint) => {
    if (!isRecord(endpoint)) return false;
    return (
      typeof endpoint.sectionNumber === "string" &&
      typeof endpoint.title === "string" &&
      typeof endpoint.method === "string" &&
      typeof endpoint.path === "string" &&
      typeof endpoint.description === "string" &&
      Array.isArray(endpoint.requestHeaders) &&
      Array.isArray(endpoint.pathParams) &&
      Array.isArray(endpoint.queryParams) &&
      isRecord(endpoint.response) &&
      typeof endpoint.response.statusCode === "string" &&
      typeof endpoint.response.example === "string" &&
      Array.isArray(endpoint.responseFields) &&
      Array.isArray(endpoint.errors)
    );
  });
}

function parseGeminiJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

const GEMINI_RETRY_DELAYS_MS = [2000, 4000, 8000] as const;

function isGeminiUnavailableError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 503
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /\b503\b/.test(message) || /service unavailable/i.test(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("No se pudo leer el archivo enviado.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return errorResponse("Falta el archivo a convertir.", 400);
  }

  const kind = getFileKind(file);
  if (!kind) {
    return errorResponse("El archivo debe ser .pdf o .docx.", 400);
  }

  const outputFormat = getOutputFormat(formData.get("outputFormat"));
  if (!outputFormat) {
    return errorResponse('El formato de salida debe ser "docx" o "pdf".', 400);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return errorResponse("Falta la variable de entorno GEMINI_API_KEY.", 500);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    let parts: Parameters<typeof model.generateContent>[0];

    if (kind === "docx") {
      const { value } = await mammoth.extractRawText({ buffer });
      const text = value.trim();

      if (!text) {
        return errorResponse(
          "No se pudo extraer texto del documento .docx.",
          400,
        );
      }

      parts = [
        "Extrae y estructura la documentación técnica de APIs del siguiente texto:",
        text,
      ];
    } else {
      parts = [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: buffer.toString("base64"),
          },
        },
      ];
    }

    const result = await generateContentWithRetry(model, parts);
    const text = result.response.text();

    let parsed: unknown;
    try {
      parsed = parseGeminiJson(text);
    } catch {
      return errorResponse("Gemini devolvió un JSON inválido.", 500);
    }

    if (!isApiDocSchema(parsed)) {
      return errorResponse(
        "La respuesta de Gemini no coincide con el esquema esperado.",
        500,
      );
    }

    const generated =
      outputFormat === "pdf"
        ? await generatePdfDocument(parsed)
        : await generateWordDocument(parsed);

    return fileResponse(generated, outputFormat, parsed.title);
  } catch (caught) {
    if (isGeminiUnavailableError(caught)) {
      return errorResponse(
        "El servicio de IA está temporalmente saturado, intenta de nuevo en unos minutos.",
        500,
      );
    }

    const message =
      caught instanceof Error
        ? caught.message
        : "La conversión con Gemini falló.";
    return errorResponse(message, 500);
  }
}

async function generateContentWithRetry(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  parts: Parameters<
    ReturnType<GoogleGenerativeAI["getGenerativeModel"]>["generateContent"]
  >[0],
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= GEMINI_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await model.generateContent(parts);
    } catch (error) {
      lastError = error;
      const hasRetriesLeft = attempt < GEMINI_RETRY_DELAYS_MS.length;
      if (!isGeminiUnavailableError(error) || !hasRetriesLeft) {
        throw error;
      }
      await sleep(GEMINI_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}
