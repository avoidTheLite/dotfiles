#!/usr/bin/env node
/**
 * Install identity/components through the shadcn registry (not file copies).
 * Used by `dotfiles install`, `dotfiles install-components`, and turbo gen.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const UI_DIR_SEGMENTS = ['src', 'components', 'ui'];
export const MOLECULE_DIR_SEGMENTS = ['src', 'components', 'molecules'];
export const GITHUB_REGISTRY = 'avoidTheLite/dotfiles';
export const STANDARD_UI_ITEM = 'standard-ui';
export const COMPONENTS_JSON = 'components.json';

const SKIP_SCAN_DIRS = new Set([
  'node_modules',
  '.git',
  '.turbo',
  '.next',
  'build',
  'dist',
  'coverage',
]);

/**
 * @param {string} dotfilesRoot
 * @returns {string}
 */
export function componentsSourceDir(dotfilesRoot) {
  return path.join(dotfilesRoot, 'identity', 'components');
}

/**
 * @param {string} dotfilesRoot
 * @returns {string}
 */
export function componentsRegistryFile(dotfilesRoot) {
  return path.join(componentsSourceDir(dotfilesRoot), 'registry.json');
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
export function looksLikeDotfilesRoot(dir) {
  return (
    fs.existsSync(path.join(dir, 'identity', 'components', 'registry.json')) &&
    fs.existsSync(path.join(dir, 'scripts', 'dotfiles.mjs'))
  );
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
export function isBuiltRegistryDir(dir) {
  return (
    fs.existsSync(path.join(dir, `${STANDARD_UI_ITEM}.json`)) &&
    fs.existsSync(path.join(dir, 'registry.json'))
  );
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
 * @param {string[]} args
 * @param {{ cwd?: string, stdio?: 'inherit' | 'pipe' }} [options]
 * @returns {string}
 */
export function runShadcn(args, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const stdio = options.stdio ?? 'pipe';
  try {
    return execFileSync('npx', ['--yes', 'shadcn@latest', ...args], {
      cwd,
      encoding: 'utf8',
      stdio: stdio === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const err = /** @type {{ stdout?: string, stderr?: string, message?: string }} */ (error);
    const detail = [err.stderr, err.stdout, err.message].filter(Boolean).join('\n');
    throw new Error(`shadcn ${args[0] ?? ''} failed: ${detail}`.trim());
  }
}

/**
 * @param {string} dotfilesRoot
 * @returns {string | null}
 */
export function resolveDotfilesRef(dotfilesRoot) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: dotfilesRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

/**
 * @param {string} githubItem
 * @returns {string}
 */
function githubItemName(githubItem) {
  return String(githubItem).replace(/^avoidTheLite\/dotfiles\//, '').split('#')[0];
}

/**
 * Point same-repo registryDependencies at sibling built JSON files so
 * `shadcn add` does not fetch GitHub during a local install.
 *
 * @param {string} builtDir
 * @returns {void}
 */
export function localizeBuiltRegistry(builtDir) {
  for (const name of fs.readdirSync(builtDir)) {
    if (!name.endsWith('.json') || name === 'registry.json') {
      continue;
    }
    const fullPath = path.join(builtDir, name);
    const item = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    if (!Array.isArray(item.registryDependencies) || item.registryDependencies.length === 0) {
      continue;
    }
    item.registryDependencies = item.registryDependencies.map((dep) => {
      const itemName = githubItemName(dep);
      const local = path.join(builtDir, `${itemName}.json`);
      return fs.existsSync(local) ? `./${itemName}.json` : dep;
    });
    fs.writeFileSync(fullPath, `${JSON.stringify(item, null, 2)}\n`, 'utf8');
  }
}

/**
 * @param {string} sourceRegistryFile
 * @param {string} outputDir
 * @returns {string}
 */
export function buildRegistry(sourceRegistryFile, outputDir) {
  if (!fs.existsSync(sourceRegistryFile)) {
    throw new Error(`Source registry not found at ${sourceRegistryFile}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  runShadcn(['build', sourceRegistryFile, '-o', outputDir], {
    cwd: path.dirname(sourceRegistryFile),
  });
  localizeBuiltRegistry(outputDir);
  return outputDir;
}

/**
 * @param {string} targetDir
 * @returns {{
 *   projectRoot: string,
 *   uiDir: string,
 *   moleculesDir: string,
 *   flattenUi: boolean,
 * }}
 */
export function classifyInstallTarget(targetDir) {
  const resolved = path.resolve(targetDir);
  const base = path.basename(resolved);
  const parent = path.basename(path.dirname(resolved));
  const grand = path.basename(path.dirname(path.dirname(resolved)));

  if (base === 'ui' && parent === 'components' && grand === 'src') {
    return {
      projectRoot: path.dirname(path.dirname(path.dirname(resolved))),
      uiDir: resolved,
      moleculesDir: path.join(path.dirname(resolved), 'molecules'),
      flattenUi: false,
    };
  }

  if (
    fs.existsSync(path.join(resolved, 'package.json')) ||
    fs.existsSync(path.join(resolved, COMPONENTS_JSON))
  ) {
    return {
      projectRoot: resolved,
      uiDir: path.join(resolved, ...UI_DIR_SEGMENTS),
      moleculesDir: path.join(resolved, ...MOLECULE_DIR_SEGMENTS),
      flattenUi: false,
    };
  }

  return {
    projectRoot: resolved,
    uiDir: resolved,
    moleculesDir: path.join(resolved, 'molecules'),
    flattenUi: true,
  };
}

/**
 * @param {{
 *   builtDir: string,
 *   projectRoot: string,
 *   uiDir: string,
 *   moleculesDir: string,
 * }} options
 * @returns {void}
 */
export function applyInstallTargets({ builtDir, projectRoot, uiDir, moleculesDir }) {
  const relUi = path.relative(projectRoot, uiDir) || '.';
  const relMolecules = path.relative(projectRoot, moleculesDir) || '.';

  for (const name of fs.readdirSync(builtDir)) {
    if (!name.endsWith('.json') || name === 'registry.json') {
      continue;
    }
    const fullPath = path.join(builtDir, name);
    const item = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    if (!Array.isArray(item.files)) {
      continue;
    }
    for (const file of item.files) {
      const basename = path.basename(file.path ?? file.target ?? '');
      if (!basename) {
        continue;
      }
      const isMolecule =
        file.type === 'registry:component' ||
        String(file.target ?? file.path ?? '').includes('molecules');
      file.target = path.join(isMolecule ? relMolecules : relUi, basename);
    }
    fs.writeFileSync(fullPath, `${JSON.stringify(item, null, 2)}\n`, 'utf8');
  }
}

/**
 * @param {string} projectRoot
 * @returns {Record<string, unknown>}
 */
export function defaultComponentsJson(projectRoot) {
  const cssPath = fs.existsSync(path.join(projectRoot, 'src', 'index.css'))
    ? 'src/index.css'
    : fs.existsSync(path.join(projectRoot, 'src', 'globals.css'))
      ? 'src/globals.css'
      : 'src/index.css';

  return {
    $schema: 'https://ui.shadcn.com/schema.json',
    style: 'new-york',
    rsc: false,
    tsx: true,
    tailwind: {
      config: '',
      css: cssPath,
      baseColor: 'slate',
      cssVariables: true,
    },
    aliases: {
      components: '@/components',
      utils: '@/components/ui/utils',
      ui: '@/components/ui',
      lib: '@/lib',
      hooks: '@/hooks',
    },
  };
}

/**
 * @param {string} projectRoot
 * @returns {void}
 */
export function ensureShadcnProject(projectRoot) {
  fs.mkdirSync(projectRoot, { recursive: true });

  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    fs.writeFileSync(
      packageJsonPath,
      `${JSON.stringify(
        {
          name: path.basename(projectRoot) || 'ui',
          private: true,
          type: 'module',
          dependencies: {
            react: '^18.3.1',
            'react-dom': '^18.3.1',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    fs.writeFileSync(
      tsconfigPath,
      `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            strict: true,
            baseUrl: '.',
            paths: {
              '@/*': ['./src/*'],
            },
          },
          include: ['src'],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  const componentsJsonPath = path.join(projectRoot, COMPONENTS_JSON);
  if (!fs.existsSync(componentsJsonPath)) {
    fs.writeFileSync(
      componentsJsonPath,
      `${JSON.stringify(defaultComponentsJson(projectRoot), null, 2)}\n`,
      'utf8',
    );
  }

  const cssPath = path.join(projectRoot, 'src', 'index.css');
  if (!fs.existsSync(cssPath) && !fs.existsSync(path.join(projectRoot, 'src', 'globals.css'))) {
    fs.mkdirSync(path.dirname(cssPath), { recursive: true });
    fs.writeFileSync(cssPath, "@import 'tailwindcss';\n", 'utf8');
  }
}

/**
 * @param {string} projectRoot
 * @returns {void}
 */
export function removeNestedPackageInstall(projectRoot) {
  for (const name of ['node_modules', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']) {
    const fullPath = path.join(projectRoot, name);
    if (!fs.existsSync(fullPath)) {
      continue;
    }
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

/**
 * @param {string} projectRoot
 * @returns {boolean}
 */
export function hasParentWorkspace(projectRoot) {
  let current = path.dirname(projectRoot);
  const root = path.parse(current).root;
  while (current && current !== root) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return true;
    }
    current = path.dirname(current);
  }
  return false;
}

/**
 * @param {{
 *   projectRoot: string,
 *   registryDir: string,
 *   item?: string,
 *   overwrite?: boolean,
 *   dryRun?: boolean,
 * }} options
 * @returns {string}
 */
export function addRegistryItem({
  projectRoot,
  registryDir,
  item = STANDARD_UI_ITEM,
  overwrite = true,
  dryRun = false,
}) {
  const itemPath = path.join(registryDir, `${item}.json`);
  if (!fs.existsSync(itemPath)) {
    throw new Error(`Registry item "${item}" not found at ${itemPath}`);
  }
  const args = ['add', '-y'];
  if (overwrite) {
    args.push('-o');
  }
  if (dryRun) {
    args.push('--dry-run');
  }
  args.push('--cwd', projectRoot, itemPath);
  return runShadcn(args, { cwd: projectRoot });
}

/**
 * @param {{
 *   projectRoot: string,
 *   item?: string,
 *   ref?: string | null,
 *   overwrite?: boolean,
 *   dryRun?: boolean,
 * }} options
 * @returns {string}
 */
export function addGithubRegistryItem({
  projectRoot,
  item = STANDARD_UI_ITEM,
  ref = null,
  overwrite = true,
  dryRun = false,
}) {
  const address = ref ? `${GITHUB_REGISTRY}/${item}#${ref}` : `${GITHUB_REGISTRY}/${item}`;
  const args = ['add', '-y'];
  if (overwrite) {
    args.push('-o');
  }
  if (dryRun) {
    args.push('--dry-run');
  }
  args.push('--cwd', projectRoot, address);
  return runShadcn(args, { cwd: projectRoot });
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listInstalledComponentFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listInstalledComponentFiles(fullPath));
    } else if (entry.name !== COMPONENTS_JSON) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * @param {{
 *   targetDir: string,
 *   sourceDir?: string | null,
 *   builtRegistryDir?: string | null,
 *   githubRef?: string | null,
 *   overwrite?: boolean,
 *   dryRun?: boolean,
 *   cleanupNestedInstall?: boolean,
 * }} options
 * @returns {{
 *   targetDir: string,
 *   projectRoot: string,
 *   uiDir: string,
 *   moleculesDir: string,
 *   files: string[],
 *   version: string,
 * }}
 */
export function installComponents({
  targetDir,
  sourceDir = null,
  builtRegistryDir = null,
  githubRef = null,
  overwrite = true,
  dryRun = false,
  cleanupNestedInstall = false,
}) {
  const classified = classifyInstallTarget(targetDir);
  const { projectRoot, uiDir, moleculesDir } = classified;
  ensureShadcnProject(projectRoot);

  let registryDir = builtRegistryDir;
  let tempDir = null;
  try {
    if (!registryDir && sourceDir && isBuiltRegistryDir(sourceDir)) {
      registryDir = sourceDir;
    } else if (!registryDir && sourceDir && fs.existsSync(path.join(sourceDir, 'registry.json'))) {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-registry-'));
      registryDir = buildRegistry(path.join(sourceDir, 'registry.json'), tempDir);
    }

    if (registryDir) {
      if (!isBuiltRegistryDir(registryDir) && fs.existsSync(path.join(registryDir, 'registry.json'))) {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-registry-'));
        registryDir = buildRegistry(path.join(registryDir, 'registry.json'), tempDir);
      }
      if (!tempDir) {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-registry-'));
        for (const name of fs.readdirSync(registryDir)) {
          fs.copyFileSync(path.join(registryDir, name), path.join(tempDir, name));
        }
        registryDir = tempDir;
      }
      applyInstallTargets({
        builtDir: registryDir,
        projectRoot,
        uiDir,
        moleculesDir,
      });
      addRegistryItem({
        projectRoot,
        registryDir,
        item: STANDARD_UI_ITEM,
        overwrite,
        dryRun,
      });
    } else {
      addGithubRegistryItem({
        projectRoot,
        item: STANDARD_UI_ITEM,
        ref: githubRef,
        overwrite,
        dryRun,
      });
    }
  } finally {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  if (cleanupNestedInstall || hasParentWorkspace(projectRoot)) {
    removeNestedPackageInstall(projectRoot);
  }

  const files = [
    ...listInstalledComponentFiles(uiDir),
    ...listInstalledComponentFiles(moleculesDir),
  ];
  const version = githubRef || 'local';

  return {
    targetDir: uiDir,
    projectRoot,
    uiDir,
    moleculesDir,
    files,
    version,
  };
}

/**
 * @param {string} root
 * @returns {string[]}
 */
export function findExistingComponentDirs(root) {
  const results = new Set();
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
        if (SKIP_SCAN_DIRS.has(entry.name)) {
          continue;
        }
        walk(fullPath);
        continue;
      }
      if (entry.name === COMPONENTS_JSON) {
        results.add(path.dirname(fullPath));
      }
      if (
        entry.name === 'Button.tsx' &&
        path.basename(current) === 'ui' &&
        path.basename(path.dirname(current)) === 'components'
      ) {
        const srcDir = path.dirname(path.dirname(current));
        if (path.basename(srcDir) === 'src') {
          results.add(path.dirname(srcDir));
        }
      }
    }
  };
  walk(root);
  return [...results];
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
      targets.push(appDir);
    }
  }
  return targets;
}

/**
 * Resolve one or more install destinations (project/app roots, or an explicit path).
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
      'Refusing to install components into the dotfiles source repository. Pass a target directory.',
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
