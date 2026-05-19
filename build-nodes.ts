#!/usr/bin/env tsx
import minimist from 'minimist';
import path from 'node:path';
import { parseSpec } from './src/parser.js';
import { generate } from './src/generator.js';
import type { CliOptions } from './src/types.js';

// ============================================================
// CLI entry point
// ============================================================

function printUsage() {
  console.log(`
Usage: tsx build-nodes.ts <spec.yaml> [options]

Options:
  -o <dir>          Output directory (default: current directory)
  --prefix <str>    npm module prefix (default: "node-red-contrib-")
  --name <str>      Node name (default: derived from spec title)
  --module <str>    Module name (default: "<prefix><name>")
  --version <str>   Version (e.g. "1.0.0")
  --keywords <str>  Additional keywords (comma-separated)
  --category <str>  Node category (default: "function")
  --icon <file>     Icon PNG file
  --color <str>     Node color (e.g. "A6BBCF")
  --help            Show this help
`);
}

function parseArgs(): CliOptions {
  const argv = minimist(process.argv.slice(2), {
    string: ['o', 'prefix', 'name', 'module', 'version', 'keywords', 'category', 'icon', 'color'],
    boolean: ['help'],
    alias: { o: 'output', h: 'help' },
    default: {
      prefix: 'node-red-contrib-',
      category: 'function',
    },
  });

  if (argv.help || argv._.length === 0) {
    printUsage();
    process.exit(argv.help ? 0 : 1);
  }

  const spec = argv._[0] as string;
  const output = (argv.output as string) ?? '.';
  const keywords = argv.keywords
    ? (argv.keywords as string).split(',').map((k: string) => k.trim())
    : [];

  return {
    spec,
    output,
    prefix: argv.prefix as string,
    name: argv.name as string | undefined,
    module: argv.module as string | undefined,
    version: argv.version as string | undefined,
    keywords,
    category: argv.category as string,
    icon: argv.icon as string | undefined,
    color: argv.color as string | undefined,
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const opts = parseArgs();
  const specPath = path.resolve(opts.spec);

  console.log(`\n[1] Loading spec: ${specPath}`);
  const nodeDef = await parseSpec(specPath);

  console.log(`\n[2] Extracted node definition:`);
  console.log(`  title      : ${nodeDef.title}`);
  console.log(`  version    : ${nodeDef.version}`);
  console.log(`  serverUrl  : ${nodeDef.serverUrl}`);
  console.log(`  endpoints  : ${nodeDef.endpoints.length}`);
  console.log(`  security   : ${nodeDef.security.length}`);

  for (const ep of nodeDef.endpoints) {
    console.log(`\n  [${ep.method.toUpperCase()}] ${ep.path}`);
    console.log(`    operationId : ${ep.operationId}`);
    console.log(`    contentType : ${ep.contentType ?? '-'}`);
    console.log(`    fields      :`);
    for (const f of ep.fields) {
      const req = f.required ? 'required' : 'optional';
      const extras =
        f.enumValues ? ` [${f.enumValues.join(' | ')}]` : '';
      console.log(`      - ${f.name} (${f.type}, ${req}, in:${f.location})${extras}`);
    }
  }

  console.log(`\n  security schemes:`);
  for (const s of nodeDef.security) {
    console.log(`    - ${s.name}: apiKey in ${s.in} (key: "${s.keyName}")`);
  }

  console.log('\n[OK] Spec parsed successfully. Next step: generate node files.');

  console.log(`\n[3] Generating node files...`);
  const outputDir = generate(nodeDef, opts);
  console.log(`\n[OK] Done. Output: ${outputDir}`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
