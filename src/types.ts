/**
 * Central type contract shared across the entire code generation pipeline.
 *
 * Data flow (producer → consumer):
 *   FieldType   : resolveFieldType (parser.ts) → FieldDef.type
 *   FieldDef    : schemaToField / makeAdditionalPropertiesField (parser.ts)
 *                   → genFieldRow, genDefaults, genWidgetInits (generate-html.ts)
 *                   → genEndpointBlock, genResolveTypedInput, body builders (generate-runtime.ts)
 *   EndpointDef : extractEndpoint (parser.ts) → all generators
 *   NodeDef     : parseSpec (parser.ts) → generateHtml / generateRuntime
 *   SecurityDef : extractSecurity (parser.ts) → genAuthConfigHtml / genAuthBlock
 *   CliOptions  : build-nodes.ts (CLI entry point) → generator.ts → generateHtml
 */

/** Flattened representation of an OpenAPI field for Node-RED UI rendering */
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'binary'
  | 'array-of-string'
  | 'unknown';

/**
 * Represents a single input parameter (path/query/header or body property) in a form
 * ready for Node-RED UI rendering and runtime value resolution.
 *
 * The `type` and `isAdditionalProperties` flags together determine the widget rendered
 * in the editor and how the runtime evaluates the stored value:
 *   - isAdditionalProperties=true  → editableList of key-value rows (map/msg widget)
 *   - type='array-of-string'       → editableList of string items (list/msg widget)
 *   - type='enum'                  → <select> (no TypedInput)
 *   - others                       → TypedInput widget
 */
export interface FieldDef {
  /** Field name */
  name: string;
  /** TypedInput widget type for the value of this field.
   *  When isAdditionalProperties=true, this is the type of each map entry's value. */
  type: FieldType;
  /** Whether the field is required */
  required: boolean;
  /** Human-readable description */
  description?: string;
  /** Default value */
  default?: unknown;
  /** Allowed values when type === 'enum' */
  enumValues?: string[];
  /** Where the parameter is sent */
  location: 'body' | 'header' | 'query' | 'path';
  /** When true, this field is a dynamic key-value map (additionalProperties).
   *  Rendered as editableList with key input + TypedInput(type) per row. */
  isAdditionalProperties?: boolean;
}

/** Definition of a single API endpoint, with all input fields flattened for UI rendering. */
export interface EndpointDef {
  /** Unique operation identifier */
  operationId: string;
  /** HTTP method: 'get' | 'post' | 'put' | ... */
  method: string;
  /** URL path, e.g. '/detect-stance' */
  path: string;
  /** Short description */
  summary?: string;
  /** e.g. 'application/json' | 'multipart/form-data' */
  contentType?: string;
  /** Flattened list of input fields */
  fields: FieldDef[];
}

/** Top-level node definition extracted from an entire OpenAPI spec; the root input to all generators. */
export interface NodeDef {
  /** info.title from the spec */
  title: string;
  /** info.version from the spec */
  version: string;
  /** info.description from the spec */
  description?: string;
  /** servers[0].url */
  serverUrl: string;
  endpoints: EndpointDef[];
  security: SecurityDef[];
}

/** Security scheme extracted from the spec */
export interface SecurityDef {
  /** Scheme name, e.g. 'apiKeyHeader' */
  name: string;
  type: 'apiKey';
  in: 'header' | 'query';
  /** Header or query param name, e.g. 'Ocp-Apim-Subscription-Key' */
  keyName: string;
}

/** Parsed CLI options */
export interface CliOptions {
  /** Required: path to the spec file */
  spec: string;
  /** -o */
  output: string;
  /** --prefix */
  prefix: string;
  /** --name */
  name?: string;
  /** --module */
  module?: string;
  /** --version */
  version?: string;
  /** --keywords */
  keywords: string[];
  /** --category */
  category: string;
  /** --icon */
  icon?: string;
  /** --color */
  color?: string;
  /** --tgz */
  tgz?: boolean;
}
