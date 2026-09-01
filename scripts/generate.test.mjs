import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { escapeJsonString, installFromConfig, normalizeConfig } from './lib/scaffold.mjs';
import {
  installComponents,
  resolveComponentInstallTargets,
} from './lib/components.mjs';

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

  const uiDir = path.join(targetDir, 'apps/web/src/components/ui');
  assert.ok(fs.existsSync(path.join(uiDir, 'Button.tsx')));
  assert.ok(fs.existsSync(path.join(uiDir, 'Card.tsx')));
  assert.ok(fs.existsSync(path.join(uiDir, 'utils.ts')));
  assert.ok(fs.existsSync(path.join(uiDir, '.dotfiles-meta.json')));
  const uiMeta = JSON.parse(fs.readFileSync(path.join(uiDir, '.dotfiles-meta.json'), 'utf8'));
  assert.equal(uiMeta.component_library_version, '1.4.1');
  const appSrc = fs.readFileSync(path.join(targetDir, 'apps/web/src/App.tsx'), 'utf8');
  assert.match(appSrc, /from '\.\/components\/ui\/Button\.tsx'/);
  assert.ok(webPkg.dependencies['class-variance-authority']);
  assert.ok(webPkg.dependencies.clsx);
  assert.ok(webPkg.dependencies['tailwind-merge']);
  assert.ok(
    fs.existsSync(path.join(targetDir, 'turbo/generators/templates/ui-components/Button.tsx')),
  );
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

test('rejects a subset or duplicate packages list', () => {
  assert.throws(
    () =>
      normalizeConfig({
        projectName: 'acme',
        packages: ['tsconfig', 'types'],
      }),
    /must include every shared package/,
  );
  assert.throws(
    () =>
      normalizeConfig({
        projectName: 'acme',
        packages: ['tsconfig', 'types', 'util', 'tsconfig'],
      }),
    /Duplicate package/,
  );
});

test('escapes description so generated package.json stays valid', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-gen-'));
  const description = 'Acme "demo" \\ repo\nline two';
  installFromConfig({
    targetDir,
    config: { projectName: 'acme', description },
    dotfilesRoot,
  });
  const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
  assert.equal(pkg.description, description);
  assert.equal(escapeJsonString(description), 'Acme \\"demo\\" \\\\ repo\\nline two');
});

test('CLI wrapper follows a PATH symlink to the repo copy of dotfiles.mjs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-bin-'));
  const binDir = path.join(tmp, '.local', 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const linkedCli = path.join(binDir, 'dotfiles');
  fs.symlinkSync(path.join(dotfilesRoot, 'scripts', 'dotfiles'), linkedCli);
  const output = execFileSync(linkedCli, ['--help'], { encoding: 'utf8' });
  assert.match(output, /dotfiles install \[target-dir\] --config/);
  assert.match(output, /dotfiles install-components \[target-dir\]/);
  assert.doesNotMatch(output, /Cannot find module/);
});

const cliPath = path.join(dotfilesRoot, 'scripts', 'dotfiles');

test('CLI install-components vendors into an explicit target directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-ui-target-'));
  const target = path.join(tmp, 'custom-ui');
  const output = execFileSync(cliPath, ['install-components', target], { encoding: 'utf8' });
  assert.match(output, /Installed standard UI components/);
  assert.ok(fs.existsSync(path.join(target, 'Button.tsx')));
  assert.ok(fs.existsSync(path.join(target, 'utils.ts')));
  assert.ok(fs.existsSync(path.join(target, '.dotfiles-meta.json')));
});

test('CLI install-components defaults to the current repo frontend ui dir', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-ui-cwd-'));
  fs.mkdirSync(path.join(tmp, 'apps', 'web'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, 'apps', 'web', 'package.json'),
    JSON.stringify({ name: '@tmp/web', dependencies: { react: '18.3.1' } }),
  );
  const output = execFileSync(cliPath, ['install-components'], {
    cwd: tmp,
    encoding: 'utf8',
  });
  assert.match(output, /apps\/web\/src\/components\/ui/);
  assert.ok(fs.existsSync(path.join(tmp, 'apps/web/src/components/ui/Button.tsx')));
});

test('CLI install-components refuses the dotfiles source repo without a target', () => {
  assert.throws(
    () =>
      execFileSync(cliPath, ['install-components'], {
        cwd: dotfilesRoot,
        encoding: 'utf8',
      }),
    /Refusing to vendor/,
  );
});

test('resolveComponentInstallTargets prefers existing vendored dirs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-ui-resolve-'));
  const existing = path.join(tmp, 'src', 'components', 'ui');
  installComponents({
    sourceDir: path.join(dotfilesRoot, 'identity', 'components'),
    targetDir: existing,
  });
  const targets = resolveComponentInstallTargets({ repoRoot: tmp });
  assert.deepEqual(targets, [existing]);
});
