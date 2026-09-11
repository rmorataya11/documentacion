import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { generatePdfDocument } from "../lib/generators/pdf-generator";
import type { ApiDocSchema } from "../lib/types";

const sample: ApiDocSchema = {
  title: "API de Ejemplo",
  subtitle: "Documentación de referencia para integraciones",
  version: "v1.0.0",
  overview:
    "Esta API permite consultar catálogos financieros y crear solicitudes de producto. Todas las respuestas usan JSON y autenticación por token.",
  errorFormatNote: {
    description:
      "Los errores siguen un formato estándar con código, mensaje y detalle opcional.",
    example: `{
  "code": "ERR_VALIDATION",
  "message": "La solicitud no es válida",
  "details": ["el campo limit es obligatorio"]
}`,
  },
  endpoints: [
    {
      sectionNumber: "2.1",
      title: "Listar Bancos",
      method: "GET",
      path: "/v1/banks",
      description:
        "Devuelve el catálogo de bancos disponibles para el canal solicitado.",
      requestHeaders: [
        {
          name: "Authorization",
          required: true,
          description: "Bearer token de autenticación",
        },
        {
          name: "X-Channel",
          required: false,
          description: "Identificador del canal de origen",
        },
      ],
      pathParams: [],
      queryParams: [
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Máximo de resultados a devolver",
        },
        {
          name: "country",
          type: "string",
          required: true,
          description: "Código ISO del país",
        },
      ],
      response: {
        statusCode: "200",
        example: `{
  "banks": [
    { "id": "001", "name": "Banco Ejemplo" }
  ]
}`,
      },
      responseFields: [
        { name: "banks", type: "array", description: "Lista de bancos" },
        { name: "banks[].id", type: "string", description: "Identificador del banco" },
        { name: "banks[].name", type: "string", description: "Nombre comercial" },
      ],
      errors: [
        {
          code: "401",
          description: "Token ausente o inválido",
          body: `{ "code": "ERR_UNAUTHORIZED" }`,
        },
        {
          code: "400",
          description: "Parámetro country inválido",
        },
      ],
    },
    {
      sectionNumber: "2.2",
      title: "Crear Solicitud",
      method: "POST",
      path: "/v1/requests/{requestId}",
      description: "Crea una solicitud de producto asociada a un cliente.",
      requestHeaders: [
        {
          name: "Authorization",
          required: true,
          description: "Bearer token de autenticación",
        },
        {
          name: "Content-Type",
          required: true,
          description: "application/json",
        },
      ],
      pathParams: [
        {
          name: "requestId",
          type: "string",
          required: true,
          description: "Identificador de la solicitud",
        },
      ],
      queryParams: [],
      requestBodyExample: `{
  "customerId": "C-1024",
  "product": "SAVINGS"
}`,
      response: {
        statusCode: "201",
        example: `{
  "id": "REQ-88",
  "status": "CREATED"
}`,
      },
      responseFields: [
        { name: "id", type: "string", description: "Identificador de la solicitud" },
        { name: "status", type: "string", description: "Estado inicial" },
      ],
      errors: [
        {
          code: "409",
          description: "La solicitud ya existe",
          body: `{ "code": "ERR_CONFLICT" }`,
        },
      ],
    },
  ],
};

async function main() {
  const buffer = await generatePdfDocument(sample);
  const outputPath = path.resolve("/tmp/test-output.pdf");
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
  console.log(`Documento generado: ${outputPath} (${buffer.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
