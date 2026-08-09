#!/usr/bin/env node
/**
 * Enforces a minimal structure on CHANGELOG.md: title, Unreleased section, at least one bullet.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const path = join(root, 'CHANGELOG.md');

if (!existsSync(path)) {
  console.error('CHANGELOG: missing CHANGELOG.md at repo root');
  process.exit(1);
}

const text = readFileSync(path, 'utf8');
if (!text.includes('# Changelog')) {
  console.error('CHANGELOG: must include a top-level "# Changelog" heading');
  process.exit(1);
}
if (!/^## (?:Unreleased|\[Unreleased\])/m.test(text)) {
  console.error('CHANGELOG: must include an "## Unreleased" section (plain or Keep a Changelog style)');
  process.exit(1);
}

// Body from Unreleased up to the next H2, or end of file
const unreleasedBlock = text.match(/^## (?:Unreleased|\[Unreleased\][^\n]*)\s*\n([\s\S]+)/m);
if (!unreleasedBlock) {
  console.error('CHANGELOG: Unreleased section could not be parsed (empty or malformed)');
  process.exit(1);
}
const full = unreleasedBlock[1];
const nextSection = full.search(/^\n## /m);
const unreleasedBody = nextSection === -1 ? full : full.slice(0, nextSection);
if (!/^\s*[-*]\s+.+$/m.test(unreleasedBody)) {
  console.error('CHANGELOG: Unreleased must contain at least one plain-language bullet (line starting with - or *)');
  process.exit(1);
}

console.log('CHANGELOG: structure OK');
