// ============================================================
// Field type definitions
// ============================================================

/** Flattened representation of an OpenAPI field for Node-RED UI rendering */
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'binary'
  | 'array-of-string'
  | 'unknown';

export interface FieldDef {
  name: string;          // Field name
  type: FieldType;       // UI widget type
  required: boolean;     // Whether the field is required
  description?: string;  // Human-readable description
  default?: unknown;     // Default value
  enumValues?: string[]; // Allowed values when type === 'enum'
  location: 'body' | 'header' | 'query' | 'path'; // Where the parameter is sent
}

/** Definition of a single endpoint */
export interface EndpointDef {
  operationId: string;   // Unique operation identifier
  method: string;        // HTTP method: 'get' | 'post' | 'put' | ...
  path: string;          // URL path, e.g. '/detect-stance'
  summary?: string;      // Short description
  contentType?: string;  // e.g. 'application/json' | 'multipart/form-data'
  fields: FieldDef[];    // Flattened list of input fields
}

/** Node definition extracted from an entire OpenAPI spec */
export interface NodeDef {
  title: string;           // info.title from the spec
  version: string;         // info.version from the spec
  description?: string;    // info.description from the spec
  serverUrl: string;       // servers[0].url
  endpoints: EndpointDef[];
  security: SecurityDef[];
}

/** Security scheme extracted from the spec */
export interface SecurityDef {
  name: string;    // Scheme name, e.g. 'apiKeyHeader'
  type: 'apiKey';
  in: 'header' | 'query';
  keyName: string; // Header or query param name, e.g. 'Ocp-Apim-Subscription-Key'
}

/** Parsed CLI options */
export interface CliOptions {
  spec: string;       // Required: path to the spec file
  output: string;     // -o
  prefix: string;     // --prefix
  name?: string;      // --name
  module?: string;    // --module
  version?: string;   // --version
  keywords: string[]; // --keywords
  category: string;   // --category
  icon?: string;      // --icon
  color?: string;     // --color
}
