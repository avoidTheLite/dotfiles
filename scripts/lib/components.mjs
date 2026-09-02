#!/usr/bin/env node
/**
 * Vendor identity/components into a target directory (typically src/components/ui).
 * Used by `dotfiles install` (new apps) and `dotfiles install-components`.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

export const UI_DIR_SEGMENTS = ['src', 'components', 'ui'];
export const META_FILENAME = '.dotfiles-meta.json';
const SKIP_WHEN_COPYING = new Set([META_FILENAME]);

/**
 * @param {string} dotfilesRoot
 * @returns {string}
 */
export function componentsSourceDir(dotfilesRoot) {
  return path.join(dotfilesRoot, 'identity', 'components');
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
export function looksLikeDotfilesRoot(dir) {
  return (
    fs.existsSync(path.join(dir, 'identity', 'components', META_FILENAME)) &&
    fs.existsSync(path.join(dir, 'scripts', 'dotfiles.mjs'))
  );
}

/**
 * @param {string} sourceDir
 * @returns {{ version: string, source: string }}
 */
export function readComponentLibraryMeta(sourceDir) {
  const metaPath = path.join(sourceDir, META_FILENAME);
  let version = 'unknown';
  let source = 'github.com/avoidTheLite/dotfiles';
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      version = meta.component_library_version || version;
      source = meta.source || source;
    } catch {
      // Keep defaults when source meta is malformed.
    }
  }
  return { version, source };
}

/**
 * @param {{ sourceDir: string, targetDir: string }} options
 * @returns {{ targetDir: string, version: string, files: string[] }}
 */
export function installComponents({ sourceDir, targetDir }) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source components directory not found at ${sourceDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const files = [];
  for (const srcFile of walkFiles(sourceDir)) {
    const relPath = path.relative(sourceDir, srcFile);
    if (path.basename(relPath) === META_FILENAME || SKIP_WHEN_COPYING.has(relPath)) {
      continue;
    }
    const destFile = path.join(targetDir, relPath);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
    files.push(destFile);
  }

  const { version, source } = readComponentLibraryMeta(sourceDir);
  const destMetaPath = path.join(targetDir, META_FILENAME);
  const targetMeta = {
    component_library_version: version,
    tools_version: version,
    source,
    last_synced: new Date().toISOString().split('T')[0],
  };
  fs.writeFileSync(destMetaPath, `${JSON.stringify(targetMeta, null, 2)}\n`, 'utf8');
  files.push(destMetaPath);

  return { targetDir, version, files };
}

/**
 * @param {string} packageJsonPath
 * @returns {boolean}
 */
export function isReactPackage(packageJsonPath) {
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return Boolean(pkg.dependencies?.react || pkg.devDependencies?.react);
  } catch {
    return false;
  }
}

/**
 * @param {string} root
 * @returns {string[]}
 */
export function findExistingComponentDirs(root) {
  const results = [];
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === '.turbo' ||
          entry.name === '.next' ||
          entry.name === 'build' ||
          entry.name === 'dist' ||
          entry.name === 'coverage'
        ) {
          continue;
        }
        walk(fullPath);
        continue;
      }
      if (entry.name === META_FILENAME) {
        results.push(path.dirname(fullPath));
      }
    }
  };
  walk(root);
  return results;
}

/**
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function findFrontendUiTargets(repoRoot) {
  const appsDir = path.join(repoRoot, 'apps');
  const targets = [];
  if (!fs.existsSync(appsDir)) {
    return targets;
  }
  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const appDir = path.join(appsDir, entry.name);
    if (isReactPackage(path.join(appDir, 'package.json'))) {
      targets.push(path.join(appDir, ...UI_DIR_SEGMENTS));
    }
  }
  return targets;
}

/**
 * Resolve one or more install destinations.
 * Explicit target wins. Otherwise reuse existing vendored dirs, then
 * `apps/<frontend>/src/components/ui`, then `src/components/ui` in the repo.
 *
 * @param {{ repoRoot: string, explicitTarget?: string | null }} options
 * @returns {string[]}
 */
export function resolveComponentInstallTargets({ repoRoot, explicitTarget = null }) {
  if (explicitTarget) {
    return [path.resolve(repoRoot, explicitTarget)];
  }

  if (looksLikeDotfilesRoot(repoRoot)) {
    throw new Error(
      'Refusing to vendor components into the dotfiles source repository. Pass a target directory.',
    );
  }

  const existing = findExistingComponentDirs(repoRoot);
  if (existing.length > 0) {
    return existing;
  }

  const frontendTargets = findFrontendUiTargets(repoRoot);
  if (frontendTargets.length > 0) {
    return frontendTargets;
  }

  return [path.join(repoRoot, ...UI_DIR_SEGMENTS)];
}
