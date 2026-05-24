import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI, OpenAPIV3 } from 'openapi-types';
import type { NodeDef, EndpointDef, FieldDef, FieldType, SecurityDef } from './types';

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
    let chosenSchema: OpenAPIV3.SchemaObject | undefined;

    for (const [ct, mt] of Object.entries(requestBody.content)) {
      const schema = (mt as OpenAPIV3.MediaTypeObject).schema as OpenAPIV3.SchemaObject | undefined;
      if (!schema) continue;
      // Use the first content type that has a schema; spec order = priority
      contentType = ct;
      chosenSchema = schema;
      break;
    }

    if (chosenSchema?.properties) {
      const required = chosenSchema.required ?? [];
      for (const [name, propSchema] of Object.entries(chosenSchema.properties)) {
        const field = schemaToField(
          name,
          propSchema as OpenAPIV3.SchemaObject,
          required.includes(name),
          (propSchema as OpenAPIV3.SchemaObject).description,
          'body'
        );
        fields.push(field);
      }
      // additionalProperties alongside properties
      if (chosenSchema.additionalProperties) {
        fields.push(makeAdditionalPropertiesField('additional_properties', chosenSchema.additionalProperties as OpenAPIV3.SchemaObject | boolean, false, 'body'));
      }
    } else if (chosenSchema?.additionalProperties) {
      // Entire body is additionalProperties
      fields.push(makeAdditionalPropertiesField('body', chosenSchema.additionalProperties as OpenAPIV3.SchemaObject | boolean, requestBody.required ?? false, 'body'));
    } else if (chosenSchema) {
      // Entire body is single field, cares Scalar body (e.g. raw binary, plain string)
      const fieldType = resolveFieldType(chosenSchema);
      if (fieldType !== 'unknown') {
        fields.push({
          name: 'body',
          type: fieldType,
          required: requestBody.required ?? false,
          description: requestBody.description,
          location: 'body',
        });
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

// Build a FieldDef for an additionalProperties entry
function makeAdditionalPropertiesField(
  name: string,
  additionalProperties: OpenAPIV3.SchemaObject | boolean,
  required: boolean,
  location: FieldDef['location']
): FieldDef {
  let type: FieldType = 'unknown';
  if (additionalProperties !== true && additionalProperties !== false) {
    type = resolveFieldType(additionalProperties as OpenAPIV3.SchemaObject);
  }
  return {
    name,
    type,
    required,
    location,
    isAdditionalProperties: true,
  };
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
