import { readFile } from "fs/promises";
import path from "path";
import {
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  convertMillimetersToTwip,
  Document,
  HeadingLevel,
  Header,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignSection,
  WidthType,
  type FileChild,
  type IBorderOptions,
  type ITableCellBorders,
} from "docx";
import type { ApiDocSchema } from "@/lib/types";
import { BRAND } from "@/lib/generators/brand-styles";

const PAGE_WIDTH = convertInchesToTwip(8.5);
const PAGE_HEIGHT = convertInchesToTwip(11);
const PAGE_MARGIN = convertMillimetersToTwip(20);
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FONT = BRAND.fonts.family;
const MONO_FONT = "Courier New";

function hex(color: string): string {
  return color.replace("#", "").toUpperCase();
}

const thinBorder: IBorderOptions = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: hex(BRAND.colors.background),
};

const cellBorders: ITableCellBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

const noBorder: IBorderOptions = {
  style: BorderStyle.NONE,
  size: 0,
  color: "FFFFFF",
};

function resolvePublicAsset(publicPath: string): string {
  return path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
}

function pngSize(buffer: Buffer): { width: number; height: number } {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function scaleToWidth(
  size: { width: number; height: number },
  targetWidth: number,
) {
  const ratio = targetWidth / size.width;
  return {
    width: Math.round(targetWidth),
    height: Math.round(size.height * ratio),
  };
}

function scaleToHeight(
  size: { width: number; height: number },
  targetHeight: number,
) {
  const ratio = targetHeight / size.height;
  return {
    width: Math.round(size.width * ratio),
    height: Math.round(targetHeight),
  };
}

async function loadPng(publicPath: string) {
  const buffer = await readFile(resolvePublicAsset(publicPath));
  return { buffer, size: pngSize(buffer) };
}

function bodyText(text: string, options?: { after?: number; before?: number }) {
  return new Paragraph({
    spacing: { after: options?.after ?? 160, before: options?.before ?? 0 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 22,
        color: hex(BRAND.colors.foreground),
      }),
    ],
  });
}

function heading1(text: string, color = BRAND.colors.foregroundStrong) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    keepNext: true,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 36,
        bold: true,
        color: hex(color),
      }),
    ],
  });
}

function heading2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    keepNext: true,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 26,
        bold: true,
        color: hex(BRAND.colors.foregroundStrong),
      }),
    ],
  });
}

function codeBlock(content: string): Table {
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: {
              type: ShadingType.CLEAR,
              fill: hex(BRAND.colors.background),
              color: "auto",
            },
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
            },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: lines.map(
              (line) =>
                new Paragraph({
                  spacing: { after: 0, before: 0 },
                  children: [
                    new TextRun({
                      text: line.length > 0 ? line : " ",
                      font: MONO_FONT,
                      size: 18,
                      color: hex(BRAND.colors.foreground),
                    }),
                  ],
                }),
            ),
          }),
        ],
      }),
    ],
  });
}

function requiredLabel(required: boolean): string {
  return required ? "Sí" : "No";
}

function tableCell(
  text: string,
  options: {
    header?: boolean;
    width: number;
  },
) {
  return new TableCell({
    width: { size: options.width, type: WidthType.DXA },
    shading: options.header
      ? {
          type: ShadingType.CLEAR,
          fill: hex(BRAND.colors.surfaceDark),
          color: "auto",
        }
      : {
          type: ShadingType.CLEAR,
          fill: hex(BRAND.colors.surface),
          color: "auto",
        },
    borders: cellBorders,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: FONT,
            size: 18,
            bold: Boolean(options.header),
            color: hex(
              options.header ? BRAND.colors.surface : BRAND.colors.foreground,
            ),
          }),
        ],
      }),
    ],
  });
}

function createTable(headers: string[], rows: string[][]): Table {
  const columnWidths = headers.map(() =>
    Math.floor(CONTENT_WIDTH / headers.length),
  );
  const leftover = CONTENT_WIDTH - columnWidths.reduce((sum, w) => sum + w, 0);
  columnWidths[columnWidths.length - 1] += leftover;

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        height: { value: 300, rule: HeightRule.ATLEAST },
        children: headers.map((header, index) =>
          tableCell(header, { header: true, width: columnWidths[index] }),
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((cell, index) =>
              tableCell(cell, { width: columnWidths[index] }),
            ),
          }),
      ),
    ],
  });
}

function spacer(after = 200) {
  return new Paragraph({
    spacing: { after },
    children: [],
  });
}

async function buildCoverSection(data: ApiDocSchema) {
  const fullLogo = await loadPng(BRAND.logos.full);
  const logoSize = scaleToWidth(fullLogo.size, 360);

  return {
    properties: {
      type: "nextPage" as const,
      verticalAlign: VerticalAlignSection.CENTER,
      page: {
        size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        margin: {
          top: PAGE_MARGIN,
          right: PAGE_MARGIN,
          bottom: PAGE_MARGIN,
          left: PAGE_MARGIN,
        },
      },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [
          new ImageRun({
            type: "png",
            data: fullLogo.buffer,
            transformation: logoSize,
            altText: {
              title: "Davivienda",
              description: "Logo Davivienda",
            },
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: data.title,
            font: FONT,
            size: 56,
            bold: true,
            color: hex(BRAND.colors.foreground),
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 280 },
        children: [
          new TextRun({
            text: data.subtitle,
            font: FONT,
            size: 32,
            color: hex(BRAND.colors.foregroundStrong),
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: data.version,
            font: FONT,
            size: 22,
            color: hex(BRAND.colors.textMuted),
          }),
        ],
      }),
    ],
  };
}

async function buildContentHeader() {
  const icon = await loadPng(BRAND.logos.icon);
  const iconSize = scaleToHeight(icon.size, 28);

  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 80 },
        children: [
          new ImageRun({
            type: "png",
            data: icon.buffer,
            transformation: iconSize,
            altText: {
              title: "Davivienda",
              description: "Ícono Davivienda",
            },
          }),
        ],
      }),
      new Paragraph({
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            color: hex(BRAND.colors.accent),
            size: 12,
            space: 1,
          },
        },
        spacing: { after: 0 },
        children: [new TextRun("")],
      }),
    ],
  });
}

function buildEndpointChildren(
  endpoint: ApiDocSchema["endpoints"][number],
): FileChild[] {
  const children: FileChild[] = [
    heading1(`${endpoint.sectionNumber} ${endpoint.title}`, BRAND.colors.accent),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: `Endpoint: ${endpoint.method} ${endpoint.path}`,
          font: MONO_FONT,
          size: 22,
          color: hex(BRAND.colors.foreground),
        }),
      ],
    }),
    bodyText(endpoint.description),
  ];

  if (endpoint.requestHeaders.length > 0) {
    children.push(heading2("Request Headers"));
    children.push(
      createTable(
        ["Header", "Requerido", "Descripción"],
        endpoint.requestHeaders.map((header) => [
          header.name,
          requiredLabel(header.required),
          header.description,
        ]),
      ),
    );
    children.push(spacer(160));
  }

  if (endpoint.pathParams.length > 0) {
    children.push(heading2("Path Parameters"));
    children.push(
      createTable(
        ["Parámetro", "Tipo", "Requerido", "Descripción"],
        endpoint.pathParams.map((param) => [
          param.name,
          param.type,
          requiredLabel(param.required),
          param.description,
        ]),
      ),
    );
    children.push(spacer(160));
  }

  if (endpoint.queryParams.length > 0) {
    children.push(heading2("Query Parameters"));
    children.push(
      createTable(
        ["Parámetro", "Tipo", "Requerido", "Descripción"],
        endpoint.queryParams.map((param) => [
          param.name,
          param.type,
          requiredLabel(param.required),
          param.description,
        ]),
      ),
    );
    children.push(spacer(160));
  }

  if (endpoint.requestBodyExample) {
    children.push(heading2("Request Body Example"));
    children.push(codeBlock(endpoint.requestBodyExample));
    children.push(spacer(160));
  }

  children.push(heading2("Response"));
  children.push(bodyText(`Status: ${endpoint.response.statusCode}`));
  children.push(codeBlock(endpoint.response.example));
  children.push(spacer(160));

  if (endpoint.responseFields.length > 0) {
    children.push(heading2("Response Fields"));
    children.push(
      createTable(
        ["Campo", "Tipo", "Descripción"],
        endpoint.responseFields.map((field) => [
          field.name,
          field.type,
          field.description,
        ]),
      ),
    );
    children.push(spacer(160));
  }

  children.push(heading2("Error Responses"));
  if (endpoint.errors.length > 0) {
    const includeBody = endpoint.errors.some((error) => Boolean(error.body));
    const headers = includeBody
      ? ["Code", "Description", "Cuerpo"]
      : ["Code", "Description"];
    children.push(
      createTable(
        headers,
        endpoint.errors.map((error) =>
          includeBody
            ? [error.code, error.description, error.body ?? ""]
            : [error.code, error.description],
        ),
      ),
    );
  } else {
    children.push(bodyText("No se documentaron respuestas de error."));
  }

  return children;
}

export async function generateWordDocument(
  data: ApiDocSchema,
): Promise<Buffer> {
  const cover = await buildCoverSection(data);
  const header = await buildContentHeader();
  const contentChildren: FileChild[] = [
    heading1("Overview"),
    bodyText(data.overview),
  ];

  if (data.errorFormatNote) {
    contentChildren.push(heading2("Formato Estándar de Errores"));
    contentChildren.push(bodyText(data.errorFormatNote.description));
    contentChildren.push(codeBlock(data.errorFormatNote.example));
    contentChildren.push(spacer(160));
  }

  for (const endpoint of data.endpoints) {
    contentChildren.push(...buildEndpointChildren(endpoint));
  }

  const document = new Document({
    title: data.title,
    description: data.subtitle,
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: 22,
            color: hex(BRAND.colors.foreground),
          },
        },
        heading1: {
          run: {
            font: FONT,
            size: 36,
            bold: true,
            color: hex(BRAND.colors.foregroundStrong),
          },
        },
        heading2: {
          run: {
            font: FONT,
            size: 26,
            bold: true,
            color: hex(BRAND.colors.foregroundStrong),
          },
        },
      },
    },
    sections: [
      cover,
      {
        headers: { default: header },
        properties: {
          type: "nextPage",
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: {
              top: convertMillimetersToTwip(28),
              right: PAGE_MARGIN,
              bottom: PAGE_MARGIN,
              left: PAGE_MARGIN,
              header: convertMillimetersToTwip(10),
            },
          },
        },
        children: contentChildren,
      },
    ],
  });

  return Packer.toBuffer(document);
}
