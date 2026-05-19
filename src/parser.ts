import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI, OpenAPIV3 } from 'openapi-types';
import type {
  NodeDef,
  EndpointDef,
  FieldDef,
  FieldType,
  SecurityDef,
} from './types.js';

// ============================================================
// Parse an OpenAPI spec file and convert it to a NodeDef
// ============================================================

export async function parseSpec(specPath: string): Promise<NodeDef> {
  const api = (await SwaggerParser.dereference(specPath)) as OpenAPIV3.Document;

  const title = api.info.title;
  const version = api.info.version;
  const description = api.info.description;
  const serverUrl = api.servers?.[0]?.url ?? '';

  // Extract security schemes
  const security = extractSecurity(api);

  // Extract endpoints
  const endpoints: EndpointDef[] = [];
  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem) continue;
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
    for (const method of methods) {
      const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
      if (!operation) continue;

      const endpoint = extractEndpoint(method, path, operation);
      endpoints.push(endpoint);
    }
  }

  return { title, version, description, serverUrl, endpoints, security };
}

// ============================================================
// Extract a single endpoint into an EndpointDef
// ============================================================

function extractEndpoint(
  method: string,
  path: string,
  operation: OpenAPIV3.OperationObject
): EndpointDef {
  const operationId =
    operation.operationId ?? `${method}-${path.replace(/\//g, '-').replace(/[{}]/g, '')}`;
  const summary = operation.summary;
  const fields: FieldDef[] = [];

  // Path, query, and header parameters
  for (const param of (operation.parameters ?? []) as OpenAPIV3.ParameterObject[]) {
    const schema = param.schema as OpenAPIV3.SchemaObject | undefined;
    const field = schemaToField(
      param.name,
      schema ?? {},
      param.required ?? false,
      param.description,
      param.in as FieldDef['location']
    );
    fields.push(field);
  }

  // Request body
  let contentType: string | undefined;
  const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject | undefined;
  if (requestBody?.content) {
    // Prefer application/json; fall back to first available content type
    const preferredTypes = ['application/json', 'multipart/form-data'];
    contentType =
      preferredTypes.find((t) => requestBody.content[t]) ??
      Object.keys(requestBody.content)[0];

    const mediaType = requestBody.content[contentType];
    const bodySchema = mediaType?.schema as OpenAPIV3.SchemaObject | undefined;
    if (bodySchema?.properties) {
      const required = bodySchema.required ?? [];
      for (const [name, propSchema] of Object.entries(bodySchema.properties)) {
        const field = schemaToField(
          name,
          propSchema as OpenAPIV3.SchemaObject,
          required.includes(name),
          (propSchema as OpenAPIV3.SchemaObject).description,
          'body'
        );
        fields.push(field);
      }
    }
  }

  return { operationId, method, path, summary, contentType, fields };
}

// ============================================================
// Convert an OpenAPI schema object to a FieldDef
// ============================================================

function schemaToField(
  name: string,
  schema: OpenAPIV3.SchemaObject,
  required: boolean,
  description: string | undefined,
  location: FieldDef['location']
): FieldDef {
  const type = resolveFieldType(schema);
  const enumValues =
    type === 'enum' ? (schema.enum as string[]) : undefined; // Only populated for enum fields

  return {
    name,
    type,
    required,
    description: description ?? schema.description,
    default: schema.default,
    enumValues,
    location,
  };
}

function resolveFieldType(schema: OpenAPIV3.SchemaObject): FieldType {
  if (schema.enum) return 'enum';
  if (schema.type === 'string' && schema.format === 'binary') return 'binary';
  if (schema.type === 'array') {
    // Only string arrays are supported as a dedicated widget
    const items = schema.items as OpenAPIV3.SchemaObject | undefined;
    if (items?.type === 'string') return 'array-of-string';
    return 'unknown';
  }
  if (schema.type === 'string') return 'string';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  return 'unknown';
}

// ============================================================
// Extract security schemes from the spec
// ============================================================

function extractSecurity(api: OpenAPIV3.Document): SecurityDef[] {
  const schemes = api.components?.securitySchemes ?? {};
  const result: SecurityDef[] = [];

  for (const [name, scheme] of Object.entries(schemes)) {
    const s = scheme as OpenAPIV3.ApiKeySecurityScheme;
    if (s.type === 'apiKey') {
      result.push({
        name,
        type: 'apiKey',
        in: s.in as 'header' | 'query',
        keyName: s.name,
      });
    }
    // oauth2 and http bearer schemes are out of scope for now
  }

  return result;
}
