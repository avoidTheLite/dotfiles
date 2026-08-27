#!/usr/bin/env node
/**
 * Enforces the skill versioning policy: if a skill directory changes in the Git diff,
 * the corresponding SKILL.md must carry a version bump relative to the merge base.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

function git(args) {
  try {
    return execSync(`git -C "${root}" ${args.join(' ')}`, { encoding: 'utf8' }).trim();
  } catch (error) {
    const message = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr || error.message) : String(error);
    throw new Error(message.trim() || 'git command failed');
  }
}

function mergeBase() {
  try {
    return git(['merge-base', 'main', 'HEAD']);
  } catch {
    try {
      return git(['merge-base', 'origin/main', 'HEAD']);
    } catch {
      return null;
    }
  }
}

function parseVersion(text) {
  const match = text.match(/^version:\s*['"]?([A-Za-z0-9.+-]+)['"]?\s*$/m);
  return match ? match[1] : null;
}

function getDiffFiles() {
  const base = mergeBase();
  if (!base) {
    console.log('skill-versioning: no git base found; skip');
    process.exit(0);
  }

  try {
    const diffOut = git(['diff', '--name-only', `${base}...HEAD`]);
    return diffOut
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    console.log('skill-versioning: no relevant git diff; skip');
    process.exit(0);
  }
}

function getSkillDirectories(changedFiles) {
  const result = new Set();

  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, '/');
    if (!normalized.startsWith('skills/')) {
      continue;
    }

    const segments = normalized.split('/');
    if (segments.length < 3) {
      continue;
    }

    const [skillsDir, skillName, fileInSkill] = segments;
    if (skillsDir !== 'skills' || !skillName || skillName === 'packages' || skillName === 'AGENT.md' || skillName === 'Claude.md' || skillName === 'README.md') {
      continue;
    }

    result.add(`${skillsDir}/${skillName}`);
  }

  return [...result].sort();
}

function getPreviousVersion(skillDir) {
  const skillFile = `${skillDir}/SKILL.md`;
  const base = mergeBase();
  if (!base) {
    return null;
  }

  try {
    const previousText = git(['show', `${base}:${skillFile}`]);
    return parseVersion(previousText);
  } catch {
    return null;
  }
}

const changedFiles = getDiffFiles();
const skillDirs = getSkillDirectories(changedFiles);
if (skillDirs.length === 0) {
  console.log('skill-versioning: no skill content changes detected');
  process.exit(0);
}

let failed = false;

for (const skillDir of skillDirs) {
  const skillFile = join(root, skillDir, 'SKILL.md');
  if (!existsSync(skillFile)) {
    console.error(`skill-versioning: ${skillDir}/SKILL.md is missing`);
    failed = true;
    continue;
  }

  const currentText = readFileSync(skillFile, 'utf8');
  const currentVersion = parseVersion(currentText);
  if (!currentVersion) {
    console.error(`skill-versioning: ${skillDir}/SKILL.md is missing a valid version field`);
    failed = true;
    continue;
  }

  const previousVersion = getPreviousVersion(skillDir);
  if (previousVersion && previousVersion === currentVersion) {
    console.error(`skill-versioning: ${skillDir} changed but version did not increment (old: ${previousVersion}, new: ${currentVersion})`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`skill-versioning: OK for ${skillDirs.length} skill directory(s)`);
