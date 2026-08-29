#!/usr/bin/env node
/**
 * Copy turbo/plop generators into a target directory and render templates
 * from a JSON config object. Keep Handlebars substitution simple ({{token}})
 * so generation works without installing Plop inside this repository.
 */
import fs from 'node:fs';
import path from 'node:path';

const APP_TYPE_TO_TEMPLATE = {
  frontend_app: 'web-frontend',
  node_backend: 'node-backend',
};

const DEFAULT_PACKAGES = ['tsconfig', 'types', 'util'];
const DEFAULT_APPS = [
  { type: 'frontend_app', name: 'web' },
  { type: 'node_backend', name: 'api' },
];

const PROJECT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const SCOPE_PATTERN = /^@[a-z][a-z0-9-]*$/;
const KEBAB_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * Escape a string so it is safe inside a JSON string literal after {{token}}
 * substitution (quotes, backslashes, and control characters).
 * @param {string} value
 * @returns {string}
 */
export function escapeJsonString(value) {
  return JSON.stringify(String(value)).slice(1, -1);
}

/**
 * @param {unknown} rawPackages
 * @returns {string[]}
 */
function normalizePackages(rawPackages) {
  if (rawPackages === undefined) {
    return [...DEFAULT_PACKAGES];
  }
  if (!Array.isArray(rawPackages)) {
    throw new Error('Config "packages" must be an array of strings');
  }
  const seen = new Set();
  for (const value of rawPackages) {
    if (typeof value !== 'string') {
      throw new Error('Config "packages" must be an array of strings');
    }
    if (!DEFAULT_PACKAGES.includes(value)) {
      throw new Error(
        `Unsupported package "${value}". Required: ${DEFAULT_PACKAGES.join(', ')}`,
      );
    }
    if (seen.has(value)) {
      throw new Error(`Duplicate package "${value}"`);
    }
    seen.add(value);
  }
  const missing = DEFAULT_PACKAGES.filter((pkg) => !seen.has(pkg));
  if (missing.length > 0) {
    throw new Error(
      `Config "packages" must include every shared package (${DEFAULT_PACKAGES.join(', ')}); missing: ${missing.join(', ')}`,
    );
  }
  return [...DEFAULT_PACKAGES];
}

/**
 * @param {string} template
 * @param {Record<string, string>} data
 * @returns {string}
 */
export function renderHandlebars(template, data) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      throw new Error(`Unknown template variable: ${key}`);
    }
    const value = data[key];
    if (value === undefined || value === null) {
      throw new Error(`Template variable "${key}" is empty`);
    }
    return String(value);
  });
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
export function walkFiles(dir) {
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

/**
 * @param {string} dir
 * @returns {boolean}
 */
export function isEffectivelyEmpty(dir) {
  if (!fs.existsSync(dir)) {
    return true;
  }
  const entries = fs.readdirSync(dir).filter((name) => name !== '.git' && name !== '.DS_Store');
  return entries.length === 0;
}

/**
 * @param {unknown} raw
 * @returns {{
 *   projectName: string,
 *   scope: string,
 *   description: string,
 *   apps: Array<{ type: string, name: string }>,
 *   packages: string[],
 * }}
 */
export function normalizeConfig(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Config must be a JSON object');
  }
  const input = /** @type {Record<string, unknown>} */ (raw);
  if (typeof input.projectName !== 'string' || !PROJECT_NAME_PATTERN.test(input.projectName)) {
    throw new Error(
      'Config "projectName" is required and must be kebab-case starting with a letter (e.g. "my-app")',
    );
  }
  const projectName = input.projectName;
  const scope =
    typeof input.scope === 'string' && input.scope.length > 0 ? input.scope : `@${projectName}`;
  if (!SCOPE_PATTERN.test(scope)) {
    throw new Error('Config "scope" must look like "@myorg" (lowercase letters, digits, hyphens)');
  }
  const description =
    typeof input.description === 'string' && input.description.length > 0
      ? input.description
      : `${projectName} monorepo`;

  const apps = Array.isArray(input.apps) ? input.apps : DEFAULT_APPS;
  if (apps.length === 0) {
    throw new Error('Config "apps" must contain at least one app');
  }
  const seenNames = new Set();
  for (const app of apps) {
    if (app === null || typeof app !== 'object' || Array.isArray(app)) {
      throw new Error('Each app must be an object with "type" and "name"');
    }
    const item = /** @type {Record<string, unknown>} */ (app);
    if (typeof item.type !== 'string' || !(item.type in APP_TYPE_TO_TEMPLATE)) {
      throw new Error(
        `Unsupported app type "${String(item.type)}". Supported: ${Object.keys(APP_TYPE_TO_TEMPLATE).join(', ')}`,
      );
    }
    if (typeof item.name !== 'string' || !KEBAB_PATTERN.test(item.name)) {
      throw new Error('Each app "name" must be kebab-case starting with a letter');
    }
    if (seenNames.has(item.name)) {
      throw new Error(`Duplicate app name "${item.name}"`);
    }
    seenNames.add(item.name);
  }

  const packages = normalizePackages(input.packages);

  return {
    projectName,
    scope,
    description,
    apps: apps.map((app) => {
      const item = /** @type {{ type: string, name: string }} */ (app);
      return { type: item.type, name: item.name };
    }),
    packages,
  };
}

/**
 * @param {{ templateDir: string, destDir: string, data: Record<string, string> }} options
 * @returns {string[]} created file paths
 */
export function renderTemplateTree({ templateDir, destDir, data }) {
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template directory not found: ${templateDir}`);
  }
  const created = [];
  for (const filePath of walkFiles(templateDir)) {
    const relativePath = path.relative(templateDir, filePath);
    const renderedRelative = renderHandlebars(relativePath.replace(/\.hbs$/, ''), data);
    const destPath = path.join(destDir, renderedRelative);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const contents = fs.readFileSync(filePath);
    if (filePath.endsWith('.hbs')) {
      const rendered = renderHandlebars(contents.toString('utf8'), data);
      fs.writeFileSync(destPath, rendered, 'utf8');
    } else {
      fs.writeFileSync(destPath, contents);
    }
    created.push(destPath);
  }
  return created;
}

/**
 * @param {string} sourceDir
 * @param {string} destDir
 * @returns {void}
 */
export function copyDirectory(sourceDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const filePath of walkFiles(sourceDir)) {
    const destPath = path.join(destDir, path.relative(sourceDir, filePath));
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(filePath, destPath);
  }
}

/**
 * @param {string} dotfilesRoot
 * @returns {{ scaffoldingRoot: string, templatesRoot: string, generatorsSource: string }}
 */
export function resolveScaffoldPaths(dotfilesRoot) {
  const scaffoldingRoot = path.join(dotfilesRoot, 'identity', 'scaffolding');
  return {
    scaffoldingRoot,
    templatesRoot: path.join(scaffoldingRoot, 'templates'),
    generatorsSource: path.join(scaffoldingRoot, 'turbo', 'generators'),
  };
}

/**
 * Copy plop/turbo generator files into the target so `turbo gen` works later.
 * @param {{ targetDir: string, dotfilesRoot: string }} options
 * @returns {void}
 */
export function transferGenerators({ targetDir, dotfilesRoot }) {
  const { templatesRoot, generatorsSource, scaffoldingRoot } = resolveScaffoldPaths(dotfilesRoot);
  const destGenerators = path.join(targetDir, 'turbo', 'generators');
  fs.mkdirSync(destGenerators, { recursive: true });
  copyDirectory(templatesRoot, path.join(destGenerators, 'templates'));
  const configSource = path.join(generatorsSource, 'config.js');
  if (!fs.existsSync(configSource)) {
    throw new Error(`Turbo generator config not found: ${configSource}`);
  }
  fs.copyFileSync(configSource, path.join(destGenerators, 'config.js'));
  const plopSource = path.join(scaffoldingRoot, 'plopfile.mjs');
  if (fs.existsSync(plopSource)) {
    fs.copyFileSync(plopSource, path.join(targetDir, 'plopfile.mjs'));
  }
}

/**
 * @param {{
 *   targetDir: string,
 *   config: unknown,
 *   dotfilesRoot: string,
 *   force?: boolean,
 * }} options
 * @returns {{ config: ReturnType<typeof normalizeConfig>, created: string[] }}
 */
export function installFromConfig({ targetDir, config, dotfilesRoot, force = false }) {
  const normalized = normalizeConfig(config);
  const { templatesRoot } = resolveScaffoldPaths(dotfilesRoot);

  if (!force && !isEffectivelyEmpty(targetDir)) {
    throw new Error(
      `Target is not empty: ${targetDir}. Pass --force to overwrite, or choose an empty directory.`,
    );
  }

  fs.mkdirSync(targetDir, { recursive: true });

  transferGenerators({ targetDir, dotfilesRoot });

  const sharedData = {
    projectName: normalized.projectName,
    scope: normalized.scope,
    description: escapeJsonString(normalized.description),
    name: normalized.projectName,
  };

  const created = [];
  created.push(
    ...renderTemplateTree({
      templateDir: path.join(templatesRoot, 'monorepo-root'),
      destDir: targetDir,
      data: sharedData,
    }),
  );

  for (const packageName of normalized.packages) {
    created.push(
      ...renderTemplateTree({
        templateDir: path.join(templatesRoot, 'packages', packageName),
        destDir: path.join(targetDir, 'packages', packageName),
        data: { ...sharedData, name: packageName, packageName },
      }),
    );
  }

  for (const app of normalized.apps) {
    const templateName = APP_TYPE_TO_TEMPLATE[app.type];
    created.push(
      ...renderTemplateTree({
        templateDir: path.join(templatesRoot, templateName),
        destDir: path.join(targetDir, 'apps', app.name),
        data: { ...sharedData, name: app.name, appName: app.name },
      }),
    );
  }

  return { config: normalized, created };
}
