#!/usr/bin/env node
/**
 * Validates guides/manifest.json: JSON parse, every path exists, unique ids, DAG prerequisites.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const manifestPath = join(root, 'guides/manifest.json');

const data = JSON.parse(readFileSync(manifestPath, 'utf8'));
const { guides = [] } = data;

if (!Array.isArray(guides) || guides.length === 0) {
  console.error('manifest: guides[] is missing or empty');
  process.exit(1);
}

const ids = new Set();
for (const g of guides) {
  if (!g.id) {
    console.error('manifest: entry missing id', g);
    process.exit(1);
  }
  if (ids.has(g.id)) {
    console.error('manifest: duplicate id:', g.id);
    process.exit(1);
  }
  ids.add(g.id);
  if (g.path) {
    const abs = join(root, g.path);
    if (!existsSync(abs)) {
      console.error('manifest: path does not exist for', g.id, '→', g.path);
      process.exit(1);
    }
  }
}

const prereq = new Map();
for (const g of guides) {
  const list = g.prerequisites || [];
  for (const p of list) {
    if (!ids.has(p)) {
      console.error('manifest: unknown prerequisite', p, 'for', g.id);
      process.exit(1);
    }
  }
  prereq.set(g.id, list);
}

function hasCycle() {
  const visiting = new Set();
  const done = new Set();

  function visit(n) {
    if (done.has(n)) return false;
    if (visiting.has(n)) return true;
    visiting.add(n);
    for (const p of prereq.get(n) || []) {
      if (visit(p)) return true;
    }
    visiting.delete(n);
    done.add(n);
    return false;
  }

  for (const g of guides) {
    if (visit(g.id)) return true;
  }
  return false;
}

if (hasCycle()) {
  console.error('manifest: prerequisite graph has a cycle');
  process.exit(1);
}

console.log('manifest: OK,', guides.length, 'entries, version', data.version);
