import type { NodeDef, CliOptions } from './types.js';

export function generatePackageJson(nodeDef: NodeDef, opts: CliOptions, nodeName: string): string {
  const moduleName = opts.module ?? `${opts.prefix}${nodeName}`;
  const version = opts.version ?? '1.0.0';
  const keywords = ['node-red', 'node-red-nodegen', ...opts.keywords];

  const pkg = {
    name: moduleName,
    version,
    description: nodeDef.description ?? nodeDef.title,
    keywords,
    'node-red': {
      nodes: {
        [nodeName]: 'node.js',
      },
    },
    dependencies: {
      axios: '^1.9.0',
      'form-data': '^4.0.0',
    },
  };

  return JSON.stringify(pkg, null, 2);
}
