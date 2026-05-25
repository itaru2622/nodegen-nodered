import fs from 'node:fs';
import path from 'node:path';
import type { NodeDef, CliOptions } from './types';
import { toNodeName } from './utils';
import { generatePackageJson } from './generate-package-json';
import { generateRuntime } from './generate-runtime';
import { generateHtml } from './generate-html';

// ============================================================
// Orchestrate file generation and write output to disk
// ============================================================

export function generate(nodeDef: NodeDef, opts: CliOptions): string {
  const nodeName  = opts.name ?? toNodeName(nodeDef.title);
  const outputDir = path.resolve(opts.output, nodeName);

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Generate and write each file
  const files: Record<string, string> = {
    'package.json': generatePackageJson(nodeDef, opts, nodeName),
    'node.js':      generateRuntime(nodeDef, nodeName),
    'node.html':    generateHtml(nodeDef, nodeName, opts),
  };

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  written: ${filePath}`);
  }

  // Copy icon file to icons/ directory
  if (opts.icon) {
    const iconsDir = path.join(outputDir, 'icons');
    fs.mkdirSync(iconsDir, { recursive: true });
    const iconDst = path.join(iconsDir, path.basename(opts.icon));
    fs.copyFileSync(path.resolve(opts.icon), iconDst);
    console.log(`  written: ${iconDst}`);
  }

  return outputDir;
}
