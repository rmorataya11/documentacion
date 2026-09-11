import { readFileSync } from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import puppeteer, { type Browser } from "puppeteer";
import type { ApiDocSchema } from "@/lib/types";
import { BRAND } from "@/lib/generators/brand-styles";

const FONT = BRAND.fonts.family;
const MONO_FONT = "Courier New";

function resolvePublicAsset(publicPath: string): string {
  return path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
}

function loadPngDataUri(publicPath: string): string {
  const absolutePath = resolvePublicAsset(publicPath);
  const buffer = readFileSync(absolutePath);
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`No es un PNG válido: ${absolutePath}`);
  }
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function requiredLabel(required: boolean): string {
  return required ? "Sí" : "No";
}

function sharedStyles(): string {
  return `
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: ${BRAND.colors.foreground};
      font-family: ${FONT}, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      background: ${BRAND.colors.surface};
    }
    h1 {
      font-size: 18pt;
      font-weight: 700;
      color: ${BRAND.colors.foregroundStrong};
      margin: 18pt 0 8pt;
      page-break-after: avoid;
    }
    h1.endpoint-title {
      color: ${BRAND.colors.accent};
    }
    h2 {
      font-size: 13pt;
      font-weight: 700;
      color: ${BRAND.colors.foregroundStrong};
      margin: 14pt 0 6pt;
      page-break-after: avoid;
    }
    p { margin: 0 0 8pt; }
    .endpoint-line {
      font-family: ${MONO_FONT}, monospace;
      font-size: 11pt;
      margin: 0 0 8pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 12pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid ${BRAND.colors.background};
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
      font-size: 9pt;
    }
    th {
      background: ${BRAND.colors.surfaceDark};
      color: ${BRAND.colors.surface};
      font-weight: 700;
    }
    pre {
      margin: 0 0 12pt;
      padding: 10px 12px;
      background: ${BRAND.colors.background};
      font-family: ${MONO_FONT}, monospace;
      font-size: 9pt;
      white-space: pre-wrap;
      word-break: break-word;
      page-break-inside: avoid;
    }
  `;
}

function renderTable(headers: string[], rows: string[][]): string {
  const head = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${escapeHtml(cell.length > 0 ? cell : "—")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderEndpoint(
  endpoint: ApiDocSchema["endpoints"][number],
): string {
  const parts: string[] = [
    `<h1 class="endpoint-title">${escapeHtml(`${endpoint.sectionNumber} ${endpoint.title}`)}</h1>`,
    `<p class="endpoint-line">${escapeHtml(`Endpoint: ${endpoint.method} ${endpoint.path}`)}</p>`,
    `<p>${escapeHtml(endpoint.description)}</p>`,
  ];

  if (endpoint.requestHeaders.length > 0) {
    parts.push("<h2>Request Headers</h2>");
    parts.push(
      renderTable(
        ["Header", "Requerido", "Descripción"],
        endpoint.requestHeaders.map((header) => [
          header.name,
          requiredLabel(header.required),
          header.description,
        ]),
      ),
    );
  }

  if (endpoint.pathParams.length > 0) {
    parts.push("<h2>Path Parameters</h2>");
    parts.push(
      renderTable(
        ["Parámetro", "Tipo", "Requerido", "Descripción"],
        endpoint.pathParams.map((param) => [
          param.name,
          param.type,
          requiredLabel(param.required),
          param.description,
        ]),
      ),
    );
  }

  if (endpoint.queryParams.length > 0) {
    parts.push("<h2>Query Parameters</h2>");
    parts.push(
      renderTable(
        ["Parámetro", "Tipo", "Requerido", "Descripción"],
        endpoint.queryParams.map((param) => [
          param.name,
          param.type,
          requiredLabel(param.required),
          param.description,
        ]),
      ),
    );
  }

  if (endpoint.requestBodyExample) {
    parts.push("<h2>Request Body Example</h2>");
    parts.push(`<pre>${escapeHtml(endpoint.requestBodyExample)}</pre>`);
  }

  parts.push("<h2>Response</h2>");
  parts.push(`<p>${escapeHtml(`Status: ${endpoint.response.statusCode}`)}</p>`);
  parts.push(`<pre>${escapeHtml(endpoint.response.example)}</pre>`);

  if (endpoint.responseFields.length > 0) {
    parts.push("<h2>Response Fields</h2>");
    parts.push(
      renderTable(
        ["Campo", "Tipo", "Descripción"],
        endpoint.responseFields.map((field) => [
          field.name,
          field.type,
          field.description,
        ]),
      ),
    );
  }

  parts.push("<h2>Error Responses</h2>");
  if (endpoint.errors.length > 0) {
    const includeBody = endpoint.errors.some((error) => Boolean(error.body));
    const headers = includeBody
      ? ["Code", "Description", "Cuerpo"]
      : ["Code", "Description"];
    parts.push(
      renderTable(
        headers,
        endpoint.errors.map((error) =>
          includeBody
            ? [error.code, error.description, error.body ?? ""]
            : [error.code, error.description],
        ),
      ),
    );
  } else {
    parts.push("<p>No se documentaron respuestas de error.</p>");
  }

  return `<section class="endpoint">${parts.join("\n")}</section>`;
}

function buildCoverHtml(data: ApiDocSchema, logoFullUri: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    ${sharedStyles()}
    html, body {
      width: 8.5in;
      height: 11in;
    }
    .cover {
      width: 8.5in;
      height: 11in;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20mm;
      text-align: center;
    }
    .cover img {
      width: 360px;
      height: auto;
      margin-bottom: 20px;
    }
    .cover h1 {
      font-size: 28pt;
      font-weight: 700;
      color: ${BRAND.colors.foreground};
      margin: 0 0 8px;
    }
    .cover .subtitle {
      font-size: 16pt;
      color: ${BRAND.colors.foregroundStrong};
      margin: 0 0 14px;
    }
    .cover .version {
      font-size: 11pt;
      color: ${BRAND.colors.textMuted};
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="cover">
    <img src="${logoFullUri}" alt="Davivienda" />
    <h1>${escapeHtml(data.title)}</h1>
    <p class="subtitle">${escapeHtml(data.subtitle)}</p>
    <p class="version">${escapeHtml(data.version)}</p>
  </div>
</body>
</html>`;
}

function buildContentHtml(data: ApiDocSchema): string {
  const errorNote = data.errorFormatNote
    ? `
      <h2>Formato Estándar de Errores</h2>
      <p>${escapeHtml(data.errorFormatNote.description)}</p>
      <pre>${escapeHtml(data.errorFormatNote.example)}</pre>
    `
    : "";

  const endpoints = data.endpoints.map(renderEndpoint).join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    ${sharedStyles()}
    .content { padding: 0; }
  </style>
</head>
<body>
  <div class="content">
    <h1>Overview</h1>
    <p>${escapeHtml(data.overview)}</p>
    ${errorNote}
    ${endpoints}
  </div>
</body>
</html>`;
}

function headerTemplate(iconUri: string): string {
  return `
    <div style="width: 100%; padding: 10px 20mm 0 20mm; box-sizing: border-box; font-size: 10px;">
      <img src="${iconUri}" style="height: 28px; width: auto;" />
      <div style="margin-top: 6px; border-bottom: 1.5px solid ${BRAND.colors.accent}; width: 100%;"></div>
    </div>
  `;
}

async function htmlToPdf(
  browser: Browser,
  html: string,
  options: {
    displayHeaderFooter: boolean;
    headerTemplate?: string;
    margin: { top: string; right: string; bottom: string; left: string };
  },
): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      displayHeaderFooter: options.displayHeaderFooter,
      headerTemplate: options.headerTemplate ?? "<div></div>",
      footerTemplate: "<div></div>",
      margin: options.margin,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

async function mergePdfs(coverPdf: Buffer, contentPdf: Buffer): Promise<Buffer> {
  const merged = await PDFDocument.create();
  const coverDoc = await PDFDocument.load(coverPdf);
  const contentDoc = await PDFDocument.load(contentPdf);

  const coverPages = await merged.copyPages(
    coverDoc,
    coverDoc.getPageIndices(),
  );
  coverPages.forEach((page) => merged.addPage(page));

  const contentPages = await merged.copyPages(
    contentDoc,
    contentDoc.getPageIndices(),
  );
  contentPages.forEach((page) => merged.addPage(page));

  return Buffer.from(await merged.save());
}

export async function generatePdfDocument(
  data: ApiDocSchema,
): Promise<Buffer> {
  const logoFullUri = loadPngDataUri(BRAND.logos.full);
  const iconUri = loadPngDataUri(BRAND.logos.icon);
  const coverHtml = buildCoverHtml(data, logoFullUri);
  const contentHtml = buildContentHtml(data);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const coverPdf = await htmlToPdf(browser, coverHtml, {
      displayHeaderFooter: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    const contentPdf = await htmlToPdf(browser, contentHtml, {
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(iconUri),
      margin: { top: "28mm", right: "20mm", bottom: "20mm", left: "20mm" },
    });
    return mergePdfs(coverPdf, contentPdf);
  } finally {
    await browser.close();
  }
}
