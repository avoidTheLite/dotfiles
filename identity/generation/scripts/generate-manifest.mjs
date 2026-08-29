#!/usr/bin/env node
/**
 * Regenerates identity/generation/capability-manifest.json from the template tree.
 * Regeneration is manual (see generation_conventions in workspace-standards.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const templatesRoot = path.join(root, 'identity', 'scaffolding', 'templates');
const destPath = path.join(root, 'identity', 'generation', 'capability-manifest.json');

/**
 * Template directory name -> generator metadata that cannot be inferred from
 * the folder alone (CLI id, turbo dest token, availability).
 * @type {Record<string, {
 *   id: string,
 *   status: 'available' | 'planned',
 *   description: string,
 *   destination: string,
 * }>}
 */
const TEMPLATE_GENERATORS = {
  'monorepo-root': {
    id: 'monorepo_root',
    status: 'available',
    description: 'pnpm workspaces + Turborepo root (turbo.json, package.json, eslint, prettier)',
    destination: '.',
  },
  'web-frontend': {
    id: 'frontend_app',
    status: 'available',
    description: 'React 18 + Vite + Tailwind CSS frontend app',
    destination: 'apps/{{name}}',
  },
  'node-backend': {
    id: 'node_backend',
    status: 'available',
    description: 'Express 5 TypeScript service with health and hello routes',
    destination: 'apps/{{name}}',
  },
  packages: {
    id: 'shared_package',
    status: 'available',
    description: 'Shared workspace packages (tsconfig, types, util)',
    destination: 'packages/{{packageName}}',
  },
  'python-backend': {
    id: 'backend_service',
    status: 'planned',
    description: 'Python FastAPI backend (not included in the Node + React MVP)',
    destination: 'apps/{{name}}',
  },
};

if (!fs.existsSync(templatesRoot)) {
  throw new Error(`Template tree not found: ${templatesRoot}`);
}

const templateDirs = fs
  .readdirSync(templatesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const unknown = templateDirs.filter((name) => !(name in TEMPLATE_GENERATORS));
if (unknown.length > 0) {
  throw new Error(
    `Template directories have no generator mapping: ${unknown.join(', ')}. Update generate-manifest.mjs.`,
  );
}

const mappedDirs = Object.keys(TEMPLATE_GENERATORS);
const missing = mappedDirs.filter((name) => !templateDirs.includes(name));
if (missing.length > 0) {
  throw new Error(`Mapped generators are missing template directories: ${missing.join(', ')}`);
}

const generators = mappedDirs.map((dirName) => {
  const meta = TEMPLATE_GENERATORS[dirName];
  return {
    id: meta.id,
    status: meta.status,
    description: meta.description,
    source: `./identity/scaffolding/templates/${dirName}`,
    destination: meta.destination,
  };
});

const manifest = {
  version: '1.0.0',
  description: 'Available turbo/plop generators shipped with this dotfiles repository.',
  cli: {
    install: 'dotfiles install [target-dir] --config <file.json>',
    generate: 'dotfiles generate [target-dir] --config <file.json>',
  },
  generators,
};

fs.writeFileSync(destPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(root, destPath)} from ${templateDirs.length} template directories`);
