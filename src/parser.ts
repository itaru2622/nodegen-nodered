import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI, OpenAPIV3 } from 'openapi-types';
import type { NodeDef, EndpointDef, FieldDef, FieldType, SecurityDef } from './types';

/**
 * Parses an OpenAPI 3.x spec file and converts it into a NodeDef consumed by the code generators.
 *
 * Key design — requestBody field expansion:
 *   OpenAPI requestBody schemas are decomposed into individual FieldDef entries so that
 *   each property becomes a separately editable row in the Node-RED editor UI (TypedInput widget).
 *   This lets users mix literal values, msg/flow/global references per field, rather than
 *   having to construct the entire JSON body as a single object upstream in the flow.
 *
 *   Decomposition rules:
 *   - `properties`           → one FieldDef per property (named, individually editable).
 *   - `additionalProperties` → one FieldDef with isAdditionalProperties=true (map/msg widget),
 *                              because dynamic key sets cannot be decomposed into named fields.
 *   - Scalar body            → one FieldDef named 'body' (e.g. raw binary, plain string).
 *
 *
 * Conversion pipeline:
 *   1. parseSpec                    — entry point; dereferences $refs and builds NodeDef.
 *   2. extractEndpoint              — converts one HTTP operation into an EndpointDef.
 *   3. schemaToField                — converts one parameter/property schema into a FieldDef.
 *   4. resolveFieldType             — maps an OpenAPI schema to the internal FieldType.
 *   5. makeAdditionalPropertiesField— builds the FieldDef for additionalProperties entries.
 *   6. extractSecurity              — extracts apiKey security schemes from components.securitySchemes.
 *
 * Intentional limitations (out of scope):
 *   - Security: only apiKey is supported; oauth2 and http bearer are ignored.
 *   - Arrays: only string arrays (`items.type === 'string'`) are supported.
 *   - Fields of unknown type are silently omitted from the generated node.
 */

/**
 * Generates the NodeDef by parsing and transforming an OpenAPI 3.x spec file.
 *
 * Uses SwaggerParser.dereference (not just parse) so all $ref references are resolved
 * inline before traversal — this simplifies downstream code by eliminating reference handling.
 * Uses the first server URL as the base URL for all endpoints.
 *
 * @param specPath Path to the OpenAPI spec file (.yaml or .json).
 * @returns NodeDef consumed by generateHtml() and generateRuntime().
 */
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

/**
 * Generates one EndpointDef from a single HTTP operation object.
 *
 * Request body handling covers four cases in order:
 *   1. `properties` (+ optional `additionalProperties`) — per-field FieldDefs.
 *   2. `additionalProperties` only (no `properties`) — a single map-type FieldDef.
 *   3. Scalar body (binary, plain string) — a single 'body' FieldDef.
 *   4. No schema / unsupported type — no body fields added.
 *
 * Content type is determined by the first `requestBody.content` entry that has a schema
 * (spec order = priority).
 *
 * @param method    HTTP method string (lowercase, e.g. 'get', 'post').
 * @param path      URL path template (e.g. '/pets/{id}').
 * @param operation OpenAPI OperationObject for this method+path.
 * @returns EndpointDef with all resolved fields and content type.
 */
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
      // Entire body is a scalar field (e.g. raw binary, plain string)
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

/**
 * Generates a FieldDef from a single OpenAPI parameter or body property schema.
 *
 * @param name        Field name (parameter name or body property key).
 * @param schema      OpenAPI SchemaObject describing the field.
 * @param required    Whether the field is required.
 * @param description Overrides schema.description when provided (used for parameter-level descriptions).
 * @param location    Where the field appears in the request ('path', 'query', 'header', or 'body').
 * @returns FieldDef ready for use in EndpointDef.fields.
 */
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

/**
 * Generates the internal FieldType string from an OpenAPI SchemaObject.
 *
 * Returns 'unknown' for unsupported types (e.g. non-string arrays, plain objects).
 * Callers are responsible for filtering out unknown fields.
 *
 * @param schema OpenAPI SchemaObject to classify.
 * @returns FieldType string, or 'unknown' if the schema type is not supported.
 */
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

/**
 * Generates a FieldDef for an `additionalProperties` entry with `isAdditionalProperties: true`.
 *
 * When `additionalProperties` is a boolean (true/false), the value type is treated as
 * 'unknown' because no schema constraint is given.
 *
 * @param name                 Field name in the generated node (e.g. 'body' or 'additional_properties').
 * @param additionalProperties The additionalProperties value from the schema (SchemaObject or boolean).
 * @param required             Whether the field is required.
 * @param location             Request location ('body', etc.).
 * @returns FieldDef with isAdditionalProperties set to true.
 */
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

/**
 * Generates the SecurityDef array from the spec's `components.securitySchemes`.
 *
 * Only `apiKey` type schemes are supported; oauth2 and http bearer are out of scope.
 * Array order matches the spec, which determines the default selection in the editor's
 * scheme `<select>` when multiple schemes are defined.
 *
 * @param api Dereferenced OpenAPI document.
 * @returns Array of SecurityDef (empty if no apiKey schemes are defined).
 */
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
