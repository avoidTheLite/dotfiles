import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { installFromConfig, normalizeConfig } from './lib/scaffold.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dotfilesRoot = path.resolve(__dirname, '..');

function leftoverHandlebars(dir) {
  const leftovers = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'turbo' || entry.name === 'node_modules') {
          continue;
        }
        walk(fullPath);
        continue;
      }
      if (fullPath.endsWith('.hbs')) {
        continue;
      }
      const text = fs.readFileSync(fullPath, 'utf8');
      if (/\{\{[a-zA-Z0-9_]+\}\}/.test(text)) {
        leftovers.push(path.relative(dir, fullPath));
      }
    }
  };
  walk(dir);
  return leftovers;
}

test('normalizeConfig applies React + Node defaults', () => {
  const config = normalizeConfig({ projectName: 'acme' });
  assert.equal(config.scope, '@acme');
  assert.deepEqual(
    config.apps.map((app) => app.type),
    ['frontend_app', 'node_backend'],
  );
});

test('installFromConfig renders a React + Express monorepo', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-gen-'));
  const examplePath = path.join(
    dotfilesRoot,
    'identity',
    'generation',
    'examples',
    'react-node-monorepo.json',
  );
  const config = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
  const result = installFromConfig({
    targetDir,
    config,
    dotfilesRoot,
  });

  assert.ok(result.created.length > 10);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8')).name,
    'demo',
  );
  assert.ok(fs.existsSync(path.join(targetDir, 'apps/web/src/App.tsx')));
  assert.ok(fs.existsSync(path.join(targetDir, 'apps/api/src/app.ts')));
  assert.ok(fs.existsSync(path.join(targetDir, 'packages/types/src/index.ts')));
  assert.ok(fs.existsSync(path.join(targetDir, 'packages/util/src/logger.ts')));
  assert.ok(fs.existsSync(path.join(targetDir, 'turbo/generators/config.js')));
  assert.ok(fs.existsSync(path.join(targetDir, 'turbo/generators/templates/web-frontend')));

  const webPkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'apps/web/package.json'), 'utf8'));
  assert.equal(webPkg.name, '@demo/web');
  const apiPkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'apps/api/package.json'), 'utf8'));
  assert.equal(apiPkg.name, '@demo/api');

  const leftovers = leftoverHandlebars(targetDir);
  assert.deepEqual(leftovers, []);
});

test('rejects unknown app types', () => {
  assert.throws(
    () =>
      normalizeConfig({
        projectName: 'nope',
        apps: [{ type: 'python-backend', name: 'api' }],
      }),
    /Unsupported app type/,
  );
});
