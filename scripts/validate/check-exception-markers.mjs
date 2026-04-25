#!/usr/bin/env node
/**
 * If a file contains <!-- guide-exception, require a one-line well-formed marker:
 *   <!-- guide-exception: RULE-ID brief reason (required) -->
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

const exceptionRe = /<!--\s*guide-exception:\s*([^\n>]+?)\s*-->/g;
const wellFormed = /^\S+\s+.+$/;

const guidesDir = join(root, 'guides');
if (!existsSync(guidesDir)) {
  process.exit(0);
}

let errors = 0;
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && e.name.endsWith('.md')) {
      const t = readFileSync(p, 'utf8');
      if (!t.includes('guide-exception')) continue;
      let m;
      const re2 = new RegExp(exceptionRe.source, 'g');
      while ((m = re2.exec(t)) !== null) {
        const body = m[1].trim();
        if (!wellFormed.test(body) || body.length < 8) {
          console.error('Malformed guide-exception in', p, '— use <!-- guide-exception: rule-id reason -->');
          errors++;
        }
      }
    }
  }
}
walk(guidesDir);

if (errors > 0) process.exit(1);
console.log('exception-markers: OK');
