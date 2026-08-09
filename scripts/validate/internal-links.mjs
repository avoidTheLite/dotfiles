#!/usr/bin/env node
/**
 * Resolves relative markdown links to files under the repo root (no HTTP checks).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const EXCLUDE = new Set(['.git', 'node_modules', '.cursor']);

function walkMdFiles(dir, out, depth) {
  if (depth > 30) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (EXCLUDE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walkMdFiles(p, out, depth + 1);
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
}

const allMd = [];
walkMdFiles(root, allMd, 0);

const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;

let errors = 0;
for (const filePath of allMd) {
  const text = readFileSync(filePath, 'utf8');
  const fromDir = dirname(filePath);
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    const target = m[2].trim();
    if (target.startsWith('http:') || target.startsWith('https:') || target.startsWith('mailto:')) {
      continue;
    }
    if (target.startsWith('#')) {
      continue;
    }
    const [pathPart] = target.split('#');
    if (pathPart === '' || pathPart === '.') continue;
    const resolved = resolve(fromDir, pathPart);
    if (!resolved.startsWith(root)) {
      console.error('Link escapes repo root:', pathPart, 'in', relative(root, filePath));
      errors++;
      continue;
    }
    let ok = existsSync(resolved);
    if (!ok && !pathPart.match(/\.[a-z0-9]+$/i) && existsSync(resolved + '.md')) {
      ok = true;
    }
    if (!ok) {
      console.error('Broken link:', pathPart, 'in', relative(root, filePath));
      errors++;
    }
  }
}

if (errors > 0) {
  process.exit(1);
}
console.log('internal-links: OK (', allMd.length, 'markdown files)');
