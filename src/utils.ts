/** Convert a spec title to a kebab-case node name. e.g. "Stance Detection" → "stance-detection" */
export function toNodeName(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Convert kebab/snake/space string to PascalCase. e.g. "stance-detection" → "StanceDetection" */
export function toPascalCase(s: string): string {
  return s.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

/** Sanitize a string so it can be used as a JavaScript identifier fragment. */
export function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Config property key for a specific endpoint field.
 * e.g. operationId="post-detect-stance", field="API-Version" → "post_detect_stance__API_Version"
 */
export function fieldPropKey(operationId: string, fieldName: string): string {
  return `${sanitizeId(operationId)}__${sanitizeId(fieldName)}`;
}

/** Type companion key for a typedInput field. */
export function fieldTypePropKey(operationId: string, fieldName: string): string {
  return `${fieldPropKey(operationId, fieldName)}Type`;
}

/** Default typedInput type string for a given FieldType. */
export function defaultTypeStr(fieldType: string): string {
  switch (fieldType) {
    case 'number':         return 'num';
    case 'boolean':        return 'bool';
    case 'array-of-string': return 'list';
    default:               return 'str';
  }
}
