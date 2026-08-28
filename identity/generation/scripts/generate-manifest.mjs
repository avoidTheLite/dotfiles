#!/usr/bin/env node
/**
 * Regenerates identity/generation/capability-manifest.json from the template tree.
 * Regeneration is manual (see generation_conventions in workspace-standards.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = path.join(root, 'identity', 'generation', 'capability-manifest.json');
const parsed = JSON.parse(fs.readFileSync(source, 'utf8'));

for (const generator of parsed.generators) {
  const relative = generator.source.replace(/^\.\//, '');
  const fullPath = path.join(root, relative);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Generator source missing: ${generator.source}`);
  }
}

fs.writeFileSync(source, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(root, source)}`);
