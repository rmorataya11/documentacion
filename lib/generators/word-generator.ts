import { readFileSync } from "fs";
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
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignSection,
  VerticalAlignTable,
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
    width: Math.max(1, Math.round(targetWidth)),
    height: Math.max(1, Math.round(size.height * ratio)),
  };
}

function scaleToHeight(
  size: { width: number; height: number },
  targetHeight: number,
) {
  const ratio = targetHeight / size.height;
  return {
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(targetHeight)),
  };
}

function loadPng(publicPath: string) {
  const absolutePath = resolvePublicAsset(publicPath);
  const buffer = readFileSync(absolutePath);

  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`No es un PNG válido: ${absolutePath}`);
  }

  const size = pngSize(buffer);
  if (size.width < 1 || size.height < 1) {
    throw new Error(`PNG sin dimensiones válidas: ${absolutePath}`);
  }

  return { buffer, size, absolutePath };
}

function imageRun(
  buffer: Buffer,
  transformation: { width: number; height: number },
  alt: { id: string; name: string; description: string },
) {
  return new ImageRun({
    type: "png",
    data: Uint8Array.from(buffer),
    transformation,
    altText: {
      id: alt.id,
      name: alt.name,
      title: alt.name,
      description: alt.description,
    },
  });
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

function constraintLabel(constraint?: string): string {
  return constraint?.trim() ?? "";
}

function bulletItem(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
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
        }
      : {
          type: ShadingType.CLEAR,
          fill: hex(BRAND.colors.surface),
        },
    borders: cellBorders,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text.length > 0 ? text : "—",
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
  if (headers.length === 0) {
    throw new Error("No se puede crear una tabla sin encabezados.");
  }

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
    children: [new TextRun({ text: " ", font: FONT, size: 2 })],
  });
}

function buildCoverSection(data: ApiDocSchema) {
  const fullLogo = loadPng(BRAND.logos.full);
  const logoSize = scaleToWidth(fullLogo.size, 360);
  const coverHeight = PAGE_HEIGHT - PAGE_MARGIN * 2 - 240;

  const coverContent = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        imageRun(fullLogo.buffer, logoSize, {
          id: "1",
          name: "Logo Davivienda",
          description: "Logo Davivienda",
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
  ];

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
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [CONTENT_WIDTH],
        layout: TableLayoutType.FIXED,
        borders: TableBorders.NONE,
        rows: [
          new TableRow({
            height: { value: coverHeight, rule: HeightRule.EXACT },
            children: [
              new TableCell({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                verticalAlign: VerticalAlignTable.CENTER,
                borders: {
                  top: noBorder,
                  bottom: noBorder,
                  left: noBorder,
                  right: noBorder,
                },
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: coverContent,
              }),
            ],
          }),
        ],
      }),
    ],
  };
}

function buildContentHeader() {
  const icon = loadPng(BRAND.logos.icon);
  const iconSize = scaleToHeight(icon.size, 28);

  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 80 },
        children: [
          imageRun(icon.buffer, iconSize, {
            id: "2",
            name: "Icono Davivienda",
            description: "Icono Davivienda",
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
        children: [new TextRun({ text: " ", font: FONT, size: 2 })],
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
        ["Parámetro", "Tipo", "Requerido", "Restricción", "Descripción"],
        endpoint.pathParams.map((param) => [
          param.name,
          param.type,
          requiredLabel(param.required),
          constraintLabel(param.constraint),
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
        ["Parámetro", "Tipo", "Requerido", "Restricción", "Descripción"],
        endpoint.queryParams.map((param) => [
          param.name,
          param.type,
          requiredLabel(param.required),
          constraintLabel(param.constraint),
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
        ["Campo", "Tipo", "Restricción", "Descripción"],
        endpoint.responseFields.map((field) => [
          field.name,
          field.type,
          constraintLabel(field.constraint),
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

async function fixWordCompatibility(buffer: Buffer): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir || !name.endsWith(".rels")) continue;

    const rels = await file.async("string");
    if (!rels.includes('Id="rId0"')) continue;

    zip.file(name, rels.split('Id="rId0"').join('Id="rId1"'));

    const partName = name.replace("_rels/", "").replace(".rels", "");
    const part = zip.file(partName);
    if (!part) continue;

    const xml = await part.async("string");
    zip.file(partName, xml.split('r:embed="rId0"').join('r:embed="rId1"'));
  }

  return Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    }),
  );
}

export async function generateWordDocument(
  data: ApiDocSchema,
): Promise<Buffer> {
  const cover = buildCoverSection(data);
  const header = buildContentHeader();
  const contentChildren: FileChild[] = [
    heading1("Overview"),
    bodyText(data.overview),
  ];

  if (data.capabilities && data.capabilities.length > 0) {
    contentChildren.push(heading1("Capacidades"));
    contentChildren.push(
      ...data.capabilities.map((capability) => bulletItem(capability)),
    );
    contentChildren.push(spacer(80));
  }

  if (data.security) {
    contentChildren.push(heading1("Seguridad"));
    contentChildren.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: data.security.mechanism,
            font: FONT,
            size: 22,
            bold: true,
            color: hex(BRAND.colors.foreground),
          }),
          new TextRun({
            text: ` ${data.security.description}`,
            font: FONT,
            size: 22,
            color: hex(BRAND.colors.foreground),
          }),
        ],
      }),
    );
  }

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

  const packed = await Packer.toBuffer(document);
  return fixWordCompatibility(packed);
}
