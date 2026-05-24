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

/** Definition of a single endpoint */
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

/** Node definition extracted from an entire OpenAPI spec */
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
}
