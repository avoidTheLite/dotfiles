#!/usr/bin/env node
/**
 * In CI (or when REQUIRE_CHANGELOG_FOR_GUIDES=1 and git is available), fail if
 * files under guides/, scripts/validate, .github, or config/ changed but CHANGELOG.md did not.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

if (process.env.SKIP_CHANGELOG_GATES === '1') {
  console.log('check-guides-changelog: skipped (SKIP_CHANGELOG_GATES=1)');
  process.exit(0);
}

const requireGate = process.env.REQUIRE_CHANGELOG_FOR_GUIDES === '1' || process.env.CI === 'true';
if (!requireGate) {
  console.log('check-guides-changelog: skip (set REQUIRE_CHANGELOG_FOR_GUIDES=1 or CI=true to enable)');
  process.exit(0);
}

function mergeBase() {
  try {
    return execSync('git merge-base main HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    try {
      return execSync('git merge-base origin/main HEAD', { cwd: root, encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  }
}

const base = mergeBase();
if (!base) {
  console.log('check-guides-changelog: no git base found; skip');
  process.exit(0);
}

let diffOut;
try {
  diffOut = execSync(`git diff --name-only ${base}...HEAD`, { cwd: root, encoding: 'utf8' });
} catch {
  console.log('check-guides-changelog: no diff; skip');
  process.exit(0);
}
if (!diffOut) {
  console.log('check-guides-changelog: no diff; skip');
  process.exit(0);
}

const names = diffOut
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const triggers = (n) =>
  n.startsWith('guides/') ||
  n.startsWith('scripts/validate/') ||
  n.startsWith('.github/') ||
  n === 'config/branch-standards.json' ||
  n === '.gitleaks.toml' ||
  n === 'guides/manifest.json';

const needsChangelog = names.some((n) => n !== 'CHANGELOG.md' && triggers(n));
if (!needsChangelog) {
  console.log('check-guides-changelog: no normative path changes; OK');
  process.exit(0);
}

if (names.includes('CHANGELOG.md')) {
  console.log('check-guides-changelog: CHANGELOG.md updated; OK');
  process.exit(0);
}

console.error('check-guides-changelog: normative files changed; CHANGELOG.md must be updated in the same change.');
process.exit(1);
