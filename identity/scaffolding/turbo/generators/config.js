/**
 * Turborepo code generators (Plop). Copied into generated repos as
 * turbo/generators/config.js so `pnpm exec turbo gen` can add more apps later.
 *
 * @param {import('node-plop').NodePlopAPI} plop
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installComponents } from './lib/components.mjs';
import { installDatabaseOverlay, normalizeDatabaseConfig } from './lib/database.mjs';

const generatorsDir = path.dirname(fileURLToPath(import.meta.url));

export default function generator(plop) {
  plop.setActionType('addUiComponents', (answers) => {
    const appDir = path.join(process.cwd(), 'apps', answers.name);
    const result = installComponents({
      targetDir: appDir,
      builtRegistryDir: path.join(generatorsDir, 'registry'),
      overwrite: true,
      cleanupNestedInstall: true,
    });
    return `installed ${result.files.length} UI files via shadcn to apps/${answers.name}/src/components`;
  });

  plop.setActionType('addDatabaseOverlay', (answers) => {
    const database = normalizeDatabaseConfig(
      { dialect: answers.dialect, testStrategy: answers.testStrategy },
      'node_backend',
    );
    if (!database) {
      throw new Error('database overlay requires a dialect');
    }
    const created = installDatabaseOverlay({
      repoRoot: process.cwd(),
      templatesRoot: path.join(generatorsDir, 'templates'),
      appName: answers.name,
      scope: answers.scope,
      projectName: answers.projectName,
      dialect: database.dialect,
      testStrategy: database.testStrategy,
    });
    return `installed query-adapter and Knex overlay (${created.length} files) on apps/${answers.name}`;
  });

  plop.setGenerator('frontend_app', {
    description: 'React 18 + Vite + Tailwind frontend app',
    prompts: [
      { type: 'input', name: 'name', message: 'App directory name (under apps/)' },
      { type: 'input', name: 'scope', message: 'Package scope (e.g. @acme)' },
      { type: 'input', name: 'projectName', message: 'Root project name' },
    ],
    actions: [
      {
        type: 'addMany',
        destination: 'apps/{{name}}/',
        base: 'templates/web-frontend',
        templateFiles: 'templates/web-frontend/**/*.hbs',
      },
      { type: 'addUiComponents' },
    ],
  });

  plop.setGenerator('node_backend', {
    description: 'Express 5 TypeScript service',
    prompts: [
      { type: 'input', name: 'name', message: 'App directory name (under apps/)' },
      { type: 'input', name: 'scope', message: 'Package scope (e.g. @acme)' },
      { type: 'input', name: 'projectName', message: 'Root project name' },
    ],
    actions: [
      {
        type: 'addMany',
        destination: 'apps/{{name}}/',
        base: 'templates/node-backend',
        templateFiles: 'templates/node-backend/**/*.hbs',
      },
    ],
  });

  plop.setGenerator('shared_package', {
    description: 'Shared workspace package (tsconfig, types, or util)',
    prompts: [
      {
        type: 'list',
        name: 'packageName',
        message: 'Which shared package?',
        choices: ['tsconfig', 'types', 'util'],
      },
      { type: 'input', name: 'scope', message: 'Package scope (e.g. @acme)' },
      { type: 'input', name: 'projectName', message: 'Root project name' },
    ],
    actions: [
      {
        type: 'addMany',
        destination: 'packages/{{packageName}}/',
        base: 'templates/packages/{{packageName}}',
        templateFiles: 'templates/packages/{{packageName}}/**/*.hbs',
      },
    ],
  });

  plop.setGenerator('database', {
    description: 'Opt-in Knex + query-adapter overlay for a Node API',
    prompts: [
      { type: 'input', name: 'name', message: 'Node app directory name (under apps/)' },
      { type: 'input', name: 'scope', message: 'Package scope (e.g. @acme)' },
      { type: 'input', name: 'projectName', message: 'Root project name' },
      {
        type: 'list',
        name: 'dialect',
        message: 'Production dialect',
        choices: ['postgres', 'sqlite'],
        default: 'postgres',
      },
      {
        type: 'list',
        name: 'testStrategy',
        message: 'Test/dev strategy (sqlite-pg-proxy is the default when production is postgres)',
        choices: ['sqlite-pg-proxy', 'sqlite', 'postgres'],
        default: 'sqlite-pg-proxy',
      },
    ],
    actions: [{ type: 'addDatabaseOverlay' }],
  });
}
