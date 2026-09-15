/**
 * Opt-in database overlay helpers for generated Node APIs.
 * Query-adapter installs only when a node_backend app declares `database`.
 */
import fs from 'node:fs';
import path from 'node:path';

export const QUERY_ADAPTER_PACKAGE = 'query-adapter';

export const DATABASE_DIALECTS = ['postgres', 'sqlite'];

export const TEST_STRATEGIES = ['sqlite-pg-proxy', 'sqlite', 'postgres'];

export const KNEX_DEPENDENCIES = {
  knex: '^3.1.0',
  pg: '^8.16.3',
  'better-sqlite3': '^11.10.0',
};

export const KNEX_DEV_DEPENDENCIES = {
  '@types/better-sqlite3': '^7.6.13',
  '@types/pg': '^8.15.5',
};

/**
 * @typedef {{ dialect: string, testStrategy: string }} DatabaseConfig
 */

/**
 * @param {unknown} raw
 * @param {string} appType
 * @returns {DatabaseConfig | null}
 */
export function normalizeDatabaseConfig(raw, appType) {
  if (raw === undefined || raw === null || raw === false) {
    return null;
  }
  if (appType !== 'node_backend') {
    throw new Error('Config "database" is only valid on node_backend apps');
  }
  /** @type {Record<string, unknown>} */
  let value;
  if (raw === true) {
    value = {};
  } else if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    value = /** @type {Record<string, unknown>} */ (raw);
  } else {
    throw new Error('app.database must be true or an object');
  }

  const dialect = value.dialect === undefined ? 'postgres' : value.dialect;
  if (typeof dialect !== 'string' || !DATABASE_DIALECTS.includes(dialect)) {
    throw new Error(
      `Unsupported database.dialect "${String(dialect)}". Supported: ${DATABASE_DIALECTS.join(', ')}`,
    );
  }

  let testStrategy = value.testStrategy;
  if (testStrategy === undefined) {
    testStrategy = dialect === 'postgres' ? 'sqlite-pg-proxy' : 'sqlite';
  }
  if (typeof testStrategy !== 'string' || !TEST_STRATEGIES.includes(testStrategy)) {
    throw new Error(
      `Unsupported database.testStrategy "${String(testStrategy)}". Supported: ${TEST_STRATEGIES.join(', ')}`,
    );
  }
  if (dialect !== 'postgres' && testStrategy === 'sqlite-pg-proxy') {
    throw new Error('sqlite-pg-proxy is only valid when production dialect is postgres');
  }

  return { dialect, testStrategy };
}

/**
 * @param {Record<string, unknown>} pkg
 * @param {string} scope
 * @returns {Record<string, unknown>}
 */
export function mergeApiDatabaseDependencies(pkg, scope) {
  const dependencies = {
    ...(typeof pkg.dependencies === 'object' && pkg.dependencies !== null
      ? /** @type {Record<string, string>} */ (pkg.dependencies)
      : {}),
    [`${scope}/${QUERY_ADAPTER_PACKAGE}`]: 'workspace:*',
    ...KNEX_DEPENDENCIES,
  };
  const devDependencies = {
    ...(typeof pkg.devDependencies === 'object' && pkg.devDependencies !== null
      ? /** @type {Record<string, string>} */ (pkg.devDependencies)
      : {}),
    ...KNEX_DEV_DEPENDENCIES,
  };
  const scripts = {
    ...(typeof pkg.scripts === 'object' && pkg.scripts !== null
      ? /** @type {Record<string, string>} */ (pkg.scripts)
      : {}),
    'db:migrate': 'knex --knexfile src/db/knexfile.ts migrate:latest',
    'db:rollback': 'knex --knexfile src/db/knexfile.ts migrate:rollback',
  };
  return { ...pkg, dependencies, devDependencies, scripts };
}

/**
 * @param {Record<string, unknown>} pkg
 * @returns {Record<string, unknown>}
 */
export function mergeRootNativeDeps(pkg) {
  const pnpm =
    typeof pkg.pnpm === 'object' && pkg.pnpm !== null
      ? { .../** @type {Record<string, unknown>} */ (pkg.pnpm) }
      : {};
  const existing = Array.isArray(pnpm.onlyBuiltDependencies)
    ? pnpm.onlyBuiltDependencies.filter((value) => typeof value === 'string')
    : [];
  pnpm.onlyBuiltDependencies = [...new Set([...existing, 'better-sqlite3'])];
  return { ...pkg, pnpm };
}

/**
 * @param {string} envText
 * @param {{ hasDatabase: boolean }} options
 * @returns {string}
 */
export function appendRuntimeEnvExample(envText, { hasDatabase }) {
  let next = envText.trimEnd();
  if (!/^LOG_LEVEL=/m.test(next)) {
    next += [
      '',
      '',
      '# Logging (generated API reads these via Zod in apps/*/src/config.ts)',
      'LOG_LEVEL=info',
      'NODE_ENV=development',
      'APP_ENV=development',
    ].join('\n');
  }
  if (hasDatabase && !/^DATABASE_URL=/m.test(next)) {
    next += [
      '',
      '',
      '# Database. When production dialect is postgres, local/test default to sqlite-pg-proxy.',
      'DATABASE_URL=file:./tmp/dev.sqlite3',
    ].join('\n');
  }
  return `${next}\n`;
}

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

/**
 * @param {string} template
 * @param {Record<string, string>} data
 * @returns {string}
 */
function renderTokens(template, data) {
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
 * Copy a template directory, substituting {{tokens}} in .hbs files and paths.
 * @param {{ templateDir: string, destDir: string, data: Record<string, string> }} options
 * @returns {string[]}
 */
export function renderTemplateDir({ templateDir, destDir, data }) {
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template directory not found: ${templateDir}`);
  }
  const created = [];
  for (const filePath of walkFiles(templateDir)) {
    const relativePath = path.relative(templateDir, filePath);
    const renderedRelative = renderTokens(relativePath.replace(/\.hbs$/, ''), data);
    const destPath = path.join(destDir, renderedRelative);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const contents = fs.readFileSync(filePath);
    if (filePath.endsWith('.hbs')) {
      fs.writeFileSync(destPath, renderTokens(contents.toString('utf8'), data), 'utf8');
    } else {
      fs.writeFileSync(destPath, contents);
    }
    created.push(destPath);
  }
  return created;
}

/**
 * @param {{
 *   repoRoot: string,
 *   templatesRoot: string,
 *   appName: string,
 *   scope: string,
 *   projectName: string,
 *   dialect: string,
 *   testStrategy: string,
 * }} options
 * @returns {string[]}
 */
export function installDatabaseOverlay({
  repoRoot,
  templatesRoot,
  appName,
  scope,
  projectName,
  dialect,
  testStrategy,
}) {
  const data = {
    projectName,
    scope,
    description: projectName,
    name: appName,
    appName,
    dialect,
    testStrategy,
    packageName: QUERY_ADAPTER_PACKAGE,
  };
  const created = [
    ...renderTemplateDir({
      templateDir: path.join(templatesRoot, 'packages', QUERY_ADAPTER_PACKAGE),
      destDir: path.join(repoRoot, 'packages', QUERY_ADAPTER_PACKAGE),
      data,
    }),
    ...renderTemplateDir({
      templateDir: path.join(templatesRoot, 'node-backend-db'),
      destDir: path.join(repoRoot, 'apps', appName),
      data,
    }),
  ];

  const apiPkgPath = path.join(repoRoot, 'apps', appName, 'package.json');
  const apiPkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf8'));
  fs.writeFileSync(
    apiPkgPath,
    `${JSON.stringify(mergeApiDatabaseDependencies(apiPkg, scope), null, 2)}\n`,
    'utf8',
  );

  const rootPkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(rootPkgPath)) {
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    fs.writeFileSync(rootPkgPath, `${JSON.stringify(mergeRootNativeDeps(rootPkg), null, 2)}\n`, 'utf8');
  }

  const envPath = path.join(repoRoot, '.env.example');
  if (fs.existsSync(envPath)) {
    fs.writeFileSync(
      envPath,
      appendRuntimeEnvExample(fs.readFileSync(envPath, 'utf8'), { hasDatabase: true }),
      'utf8',
    );
  }

  return created;
}

