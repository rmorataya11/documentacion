export interface ApiDocSchema {
  title: string;
  subtitle: string;
  version: string;
  overview: string;
  errorFormatNote?: { description: string; example: string };
  endpoints: {
    sectionNumber: string;
    title: string;
    method: string;
    path: string;
    description: string;
    requestHeaders: { name: string; required: boolean; description: string }[];
    pathParams: { name: string; type: string; required: boolean; description: string }[];
    queryParams: { name: string; type: string; required: boolean; description: string }[];
    requestBodyExample?: string;
    response: { statusCode: string; example: string };
    responseFields: { name: string; type: string; description: string }[];
    errors: { code: string; description: string; body?: string }[];
  }[];
}
