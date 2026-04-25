#!/usr/bin/env node
/**
 * For GitHub pull_request workflows, GITHUB_HEAD_REF is the source branch.
 * When set, it must match config/branch-standards.json (per-repo).
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '../../config/branch-standards.json');

const head = process.env.GITHUB_HEAD_REF;
if (!head) {
  console.log('branch-name: not a GitHub PR context (no GITHUB_HEAD_REF); skip');
  process.exit(0);
}

if (!existsSync(configPath)) {
  console.error('branch-name: missing', configPath);
  process.exit(1);
}

const { headBranchPattern } = JSON.parse(readFileSync(configPath, 'utf8'));
if (!headBranchPattern) {
  console.error('branch-name: headBranchPattern not set in config');
  process.exit(1);
}

const re = new RegExp(headBranchPattern);
if (!re.test(head)) {
  console.error('branch-name: head branch', JSON.stringify(head), 'does not match this repo pattern:', headBranchPattern);
  console.error('See config/branch-standards.json. Copy and edit that file in other repositories.');
  process.exit(1);
}
console.log('branch-name: OK for', head);
