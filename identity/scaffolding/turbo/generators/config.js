/**
 * Turborepo code generators (Plop). Copied into generated repos as
 * turbo/generators/config.js so `pnpm exec turbo gen` can add more apps later.
 *
 * @param {import('node-plop').NodePlopAPI} plop
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const generatorsDir = path.dirname(fileURLToPath(import.meta.url));
const META_FILENAME = '.dotfiles-meta.json';

function copyDirectory(sourceDir, destDir, skipNames = new Set()) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`UI component templates not found: ${sourceDir}`);
  }
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(sourceDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(src, dest, skipNames);
    } else if (!skipNames.has(entry.name)) {
      fs.copyFileSync(src, dest);
    }
  }
}

function writeVendoredMeta(sourceDir, destDir) {
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

  fs.writeFileSync(
    path.join(destDir, META_FILENAME),
    `${JSON.stringify(
      {
        component_library_version: version,
        tools_version: version,
        source,
        last_synced: new Date().toISOString().split('T')[0],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

export default function generator(plop) {
  plop.setActionType('addUiComponents', (answers) => {
    const sourceDir = path.join(generatorsDir, 'templates', 'ui-components');
    const destDir = path.join(process.cwd(), 'apps', answers.name, 'src', 'components', 'ui');
    copyDirectory(sourceDir, destDir, new Set([META_FILENAME]));
    writeVendoredMeta(sourceDir, destDir);
    return `vendored UI components to apps/${answers.name}/src/components/ui`;
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
}
