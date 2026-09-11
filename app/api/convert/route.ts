import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import { NextResponse } from "next/server";
import { generatePdfDocument } from "@/lib/generators/pdf-generator";
import { generateWordDocument } from "@/lib/generators/word-generator";
import type { ApiDocSchema } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `Eres un asistente que extrae y estructura documentación técnica de APIs. Extrae la información del documento y organízala siguiendo exactamente esta estructura: overview general del API, nota de formato estándar de errores si existe, y luego cada endpoint en el orden en que aparecen en el documento original, incluyendo para cada uno: número de sección, título, método HTTP, ruta, descripción, headers requeridos, parámetros de path, parámetros de query, ejemplo de request body si aplica, respuesta con status code y ejemplo, campos de la respuesta, y errores posibles. Si una sección opcional no está presente en el documento, omítela o déjala como array vacío — no inventes contenido que no esté en el documento original. Devuelve únicamente el JSON, sin texto adicional ni explicaciones.

El JSON debe seguir exactamente esta forma:
{
  "title": string,
  "subtitle": string,
  "version": string,
  "overview": string,
  "errorFormatNote": { "description": string, "example": string },
  "endpoints": [
    {
      "sectionNumber": string,
      "title": string,
      "method": string,
      "path": string,
      "description": string,
      "requestHeaders": [{ "name": string, "required": boolean, "description": string }],
      "pathParams": [{ "name": string, "type": string, "required": boolean, "description": string }],
      "queryParams": [{ "name": string, "type": string, "required": boolean, "description": string }],
      "requestBodyExample": string,
      "response": { "statusCode": string, "example": string },
      "responseFields": [{ "name": string, "type": string, "description": string }],
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

    const result = await model.generateContent(parts);
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
    const message =
      caught instanceof Error
        ? caught.message
        : "La conversión con Gemini falló.";
    return errorResponse(message, 500);
  }
}
