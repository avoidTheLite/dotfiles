import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { escapeJsonString, installFromConfig, normalizeConfig } from './lib/scaffold.mjs';
import { validatePortsObject, schemaDefaultPorts } from './lib/ports.mjs';
import {
  applyInstallTargets,
  findExistingComponentDirs,
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

test('committed ports file matches the ports schema defaults', () => {
  const schema = JSON.parse(
    fs.readFileSync(path.join(dotfilesRoot, 'identity', 'generation', 'ports.schema.json'), 'utf8'),
  );
  const ports = JSON.parse(fs.readFileSync(path.join(dotfilesRoot, 'config', 'ports.json'), 'utf8'));
  assert.equal(ports.web, schema.properties.web.default);
  assert.equal(ports.api, schema.properties.api.default);
  assert.equal(ports.bind, schema.properties.bind.default);
  assert.equal(ports.web, 5173);
  assert.equal(ports.api, 3000);
  assert.equal(ports.bind, '127.0.0.1');
});

test('comparison-run example has two full-tree legs and no overlay', () => {
  const generationDir = path.join(dotfilesRoot, 'identity', 'generation');
  const schema = JSON.parse(
    fs.readFileSync(path.join(generationDir, 'comparison-run.schema.json'), 'utf8'),
  );
  const example = JSON.parse(
    fs.readFileSync(path.join(generationDir, 'examples', 'comparison-run.example.json'), 'utf8'),
  );
  for (const key of schema.required) {
    assert.ok(key in example, `missing ${key}`);
  }
  assert.ok(example.legs.length >= 2);
  for (const leg of example.legs) {
    assert.ok(leg.treeSha);
    assert.equal(leg.overlay, undefined);
  }
});

test('validatePortsObject rejects unknown keys and bad ports', () => {
  const defaults = { web: 5173, api: 3000, bind: '127.0.0.1' };
  assert.throws(() => validatePortsObject({ web: 5173, api: 3000, extra: 1 }, defaults), /unknown keys/);
  assert.throws(() => validatePortsObject({ web: 0, api: 3000 }, defaults), /web/);
  const ok = validatePortsObject({ web: 5173, api: 3000 }, defaults);
  assert.equal(ok.bind, '127.0.0.1');
});

test('schemaDefaultPorts rejects missing or invalid defaults', () => {
  assert.throws(
    () => schemaDefaultPorts({ properties: { web: {}, api: { default: 3000 }, bind: { default: '127.0.0.1' } } }),
    /web\.default/,
  );
  assert.throws(
    () =>
      schemaDefaultPorts({
        properties: { web: { default: 5173 }, api: { default: 3000 }, bind: { default: '' } },
      }),
    /bind\.default/,
  );
});

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
  const moleculesDir = path.join(targetDir, 'apps/web/src/components/molecules');
  assert.ok(fs.existsSync(path.join(uiDir, 'Button.tsx')));
  assert.ok(fs.existsSync(path.join(uiDir, 'Card.tsx')));
  assert.ok(fs.existsSync(path.join(uiDir, 'utils.ts')));
  assert.ok(fs.existsSync(path.join(moleculesDir, 'Field.tsx')));
  assert.ok(fs.existsSync(path.join(moleculesDir, 'ConfirmDialog.tsx')));
  assert.ok(fs.existsSync(path.join(moleculesDir, 'EmptyState.tsx')));
  assert.ok(!fs.existsSync(path.join(uiDir, '.dotfiles-meta.json')));
  assert.ok(fs.existsSync(path.join(targetDir, 'apps/web/components.json')));
  const appSrc = fs.readFileSync(path.join(targetDir, 'apps/web/src/App.tsx'), 'utf8');
  assert.match(appSrc, /from '\.\/components\/ui\/Button\.tsx'/);
  assert.ok(webPkg.dependencies['class-variance-authority']);
  assert.ok(webPkg.dependencies.clsx);
  assert.ok(webPkg.dependencies['tailwind-merge']);
  assert.ok(fs.existsSync(path.join(targetDir, 'turbo/generators/registry/standard-ui.json')));
  assert.ok(fs.existsSync(path.join(targetDir, 'turbo/generators/lib/components.mjs')));
  const generatedPorts = JSON.parse(
    fs.readFileSync(path.join(targetDir, 'config', 'ports.json'), 'utf8'),
  );
  assert.equal(generatedPorts.web, 5173);
  assert.equal(generatedPorts.api, 3000);
  assert.equal(generatedPorts.bind, '127.0.0.1');
  const envExample = fs.readFileSync(path.join(targetDir, '.env.example'), 'utf8');
  assert.match(envExample, /^WEB_PORT=5173$/m);
  assert.match(envExample, /^API_PORT=3000$/m);
  assert.match(envExample, /^BIND=127\.0\.0\.1$/m);
  const generatedGitignore = fs.readFileSync(path.join(targetDir, '.gitignore'), 'utf8');
  assert.match(generatedGitignore, /!\.env\.example/);
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

test('CLI install-components installs into an explicit target directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-ui-target-'));
  const target = path.join(tmp, 'custom-ui');
  const output = execFileSync(cliPath, ['install-components', target], { encoding: 'utf8' });
  assert.match(output, /Installed standard UI components via shadcn registry/);
  assert.ok(fs.existsSync(path.join(target, 'src/components/ui/Button.tsx')));
  assert.ok(fs.existsSync(path.join(target, 'src/components/ui/utils.ts')));
  assert.ok(fs.existsSync(path.join(target, 'src/components/molecules/Field.tsx')));
  assert.ok(!fs.existsSync(path.join(target, 'src/components/ui/.dotfiles-meta.json')));
});

test('CLI install-components defaults to the current repo frontend ui dir', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-ui-cwd-'));
  fs.mkdirSync(path.join(tmp, 'apps', 'web'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, 'apps', 'web', 'package.json'),
    JSON.stringify({
      name: '@tmp/web',
      dependencies: { react: '18.3.1', 'react-dom': '18.3.1' },
    }),
  );
  const output = execFileSync(cliPath, ['install-components'], {
    cwd: tmp,
    encoding: 'utf8',
  });
  assert.match(output, /apps\/web/);
  assert.ok(fs.existsSync(path.join(tmp, 'apps/web/src/components/ui/Button.tsx')));
  assert.ok(fs.existsSync(path.join(tmp, 'apps/web/src/components/molecules/Field.tsx')));
});

test('CLI install-components refuses the dotfiles source repo without a target', () => {
  assert.throws(
    () =>
      execFileSync(cliPath, ['install-components'], {
        cwd: dotfilesRoot,
        encoding: 'utf8',
      }),
    /Refusing to install/,
  );
});

test('resolveComponentInstallTargets prefers existing installed projects', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-ui-resolve-'));
  const existing = path.join(tmp, 'src', 'components', 'ui');
  installComponents({
    sourceDir: path.join(dotfilesRoot, 'identity', 'components'),
    targetDir: existing,
  });
  const targets = resolveComponentInstallTargets({ repoRoot: tmp });
  assert.deepEqual(targets, [tmp]);
});

test('findExistingComponentDirs skips cache dirs but still finds components.json', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-ui-scan-'));
  const kept = path.join(tmp, 'apps', 'web');
  const skipped = [
    path.join(tmp, '.turbo', 'cache', 'ui-components'),
    path.join(tmp, '.next', 'cache', 'ui-components'),
    path.join(tmp, 'build', 'ui-components'),
  ];

  fs.mkdirSync(kept, { recursive: true });
  fs.writeFileSync(path.join(kept, 'components.json'), '{}');

  for (const dir of skipped) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'components.json'), '{}');
  }

  assert.deepEqual(findExistingComponentDirs(tmp), [kept]);
});

test('applyInstallTargets preserves nested file paths inside ui and molecules targets', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-ui-targets-'));
  const builtDir = path.join(tmp, 'registry');
  const projectRoot = path.join(tmp, 'app');
  const uiDir = path.join(projectRoot, 'custom', 'ui');
  const moleculesDir = path.join(projectRoot, 'custom', 'molecules');

  fs.mkdirSync(builtDir, { recursive: true });
  fs.writeFileSync(
    path.join(builtDir, 'nested.json'),
    `${JSON.stringify(
      {
        files: [
          {
            path: 'NestedButton.tsx',
            target: 'src/components/ui/forms/NestedButton.tsx',
            type: 'registry:ui',
          },
          {
            path: 'Field/index.ts',
            target: 'src/components/molecules/forms/Field/index.ts',
            type: 'registry:component',
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  applyInstallTargets({ builtDir, projectRoot, uiDir, moleculesDir });

  const rewritten = JSON.parse(fs.readFileSync(path.join(builtDir, 'nested.json'), 'utf8'));
  assert.deepEqual(
    rewritten.files.map((file) => file.target),
    ['custom/ui/forms/NestedButton.tsx', 'custom/molecules/forms/Field/index.ts'],
  );
});

test('generated turbo frontend installs from the copied shadcn registry', async () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-gen-'));
  installFromConfig({
    targetDir,
    config: { projectName: 'demo' },
    dotfilesRoot,
  });

  const generatedConfig = await import(pathToFileURL(path.join(targetDir, 'turbo/generators/config.js')));
  const actionTypes = new Map();
  generatedConfig.default({
    setActionType(name, action) {
      actionTypes.set(name, action);
    },
    setGenerator() {},
  });

  const adminDir = path.join(targetDir, 'apps', 'admin');
  fs.mkdirSync(adminDir, { recursive: true });
  fs.writeFileSync(
    path.join(adminDir, 'package.json'),
    `${JSON.stringify(
      {
        name: '@demo/admin',
        private: true,
        type: 'module',
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
      },
      null,
      2,
    )}\n`,
  );
  const previousCwd = process.cwd();
  process.chdir(targetDir);
  try {
    actionTypes.get('addUiComponents')({ name: 'admin' });
  } finally {
    process.chdir(previousCwd);
  }

  assert.ok(fs.existsSync(path.join(targetDir, 'apps/admin/src/components/ui/Button.tsx')));
  assert.ok(fs.existsSync(path.join(targetDir, 'apps/admin/src/components/molecules/Field.tsx')));
  assert.ok(fs.existsSync(path.join(targetDir, 'apps/admin/components.json')));
});
