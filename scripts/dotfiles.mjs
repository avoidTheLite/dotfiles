#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installFromConfig, normalizeConfig } from './lib/scaffold.mjs';
import {
  componentsSourceDir,
  findExistingComponentDirs,
  installComponents,
  resolveComponentInstallTargets,
} from './lib/components.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to run shell commands and return output or null if failed
function runCmd(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', ...options }).trim();
  } catch {
    return null;
  }
}

// Find absolute path of the dotfiles repository root from the script location
const dotfilesRoot = path.resolve(__dirname, '..');

// Helper to display CLI help
function printHelp() {
  console.log(`Dotfiles CLI

Usage:
  dotfiles install [target-dir] --config <file.json>
  dotfiles generate [target-dir] --config <file.json>
  dotfiles install-components [target-dir]
  dotfiles sync-components
  dotfiles --help

Install copies turbo/plop generators into the target directory, then renders
a monorepo from the JSON config (React app + Node service by default).
Frontend apps receive the standard UI library through the shadcn registry
(primitives under src/components/ui/ and molecules under src/components/molecules/).

Options:
  --config <path>   Path to a JSON object of generator inputs
  --example         Use identity/generation/examples/react-node-monorepo.json
  --name <slug>     Override config.projectName
  --scope <@org>    Override config.scope
  --force           Allow installing into a non-empty directory
  -h, --help        Show this help message

Options for components:
  --dry-run                         Preview shadcn add without writing files
  --auto                            Scaffold a scheduled GitHub Action for weekly sync (sync-components only)
  --force                           Force sync even if local component directories have uncommitted changes

Commands for components:
  install-components [target-dir]   Install the shadcn registry (primitives + molecules)
                                    into a path, or the current repo when omitted
  sync-components                   Re-install from the shadcn registry and open a PR

Example:
  mkdir my-app && cd my-app
  dotfiles install --example --name my-app --scope @my-app
  pnpm install
  pnpm dev
`);
}

/**
 * @param {string[]} args
 * @returns {{
 *   command: string,
 *   targetDir: string,
 *   configPath: string | null,
 *   useExample: boolean,
 *   name: string | null,
 *   scope: string | null,
 *   force: boolean,
 * }}
 */
function parseArgs(args) {
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  if (command !== 'install' && command !== 'generate') {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  let targetDir = process.cwd();
  /** @type {string | null} */
  let configPath = null;
  let useExample = false;
  /** @type {string | null} */
  let name = null;
  /** @type {string | null} */
  let scope = null;
  let force = false;

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--config') {
      configPath = args[i + 1] ?? null;
      if (!configPath) {
        throw new Error('--config requires a file path');
      }
      i += 1;
    } else if (arg.startsWith('--config=')) {
      configPath = arg.slice('--config='.length);
    } else if (arg === '--example') {
      useExample = true;
    } else if (arg === '--name') {
      name = args[i + 1] ?? null;
      if (!name) {
        throw new Error('--name requires a value');
      }
      i += 1;
    } else if (arg.startsWith('--name=')) {
      name = arg.slice('--name='.length);
    } else if (arg === '--scope') {
      scope = args[i + 1] ?? null;
      if (!scope) {
        throw new Error('--scope requires a value');
      }
      i += 1;
    } else if (arg.startsWith('--scope=')) {
      scope = arg.slice('--scope='.length);
    } else if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      targetDir = path.resolve(process.cwd(), arg);
    }
  }

  return { command, targetDir, configPath, useExample, name, scope, force };
}

function exampleConfigPath() {
  return path.join(dotfilesRoot, 'identity', 'generation', 'examples', 'react-node-monorepo.json');
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${configPath}: ${message}`);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  if (command === 'install-components') {
    let explicitTarget = null;
    for (let i = 1; i < args.length; i += 1) {
      const arg = args[i];
      if (arg === '--target') {
        explicitTarget = args[i + 1] ?? null;
        if (!explicitTarget) {
          console.error('Error: --target requires a directory.');
          process.exit(1);
        }
        i += 1;
      } else if (arg.startsWith('--target=')) {
        explicitTarget = arg.slice('--target='.length);
      } else if (arg === '--dry-run') {
        continue;
      } else if (arg.startsWith('-')) {
        console.error(`Unknown option: ${arg}`);
        console.error('Usage: dotfiles install-components [target-dir]');
        process.exit(1);
      } else if (!explicitTarget) {
        explicitTarget = arg;
      }
    }

    const sourceDir = componentsSourceDir(dotfilesRoot);
    const isDryRun = args.includes('--dry-run');
    let targets;
    try {
      targets = resolveComponentInstallTargets({
        repoRoot: process.cwd(),
        explicitTarget,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      console.error('Usage: dotfiles install-components [target-dir]');
      process.exit(1);
    }

    try {
      for (const targetDir of targets) {
        const result = installComponents({
          targetDir,
          sourceDir,
          overwrite: true,
          dryRun: isDryRun,
        });
        const display = path.relative(process.cwd(), result.projectRoot) || result.projectRoot;
        const uiDisplay = path.relative(process.cwd(), result.uiDir) || result.uiDir;
        console.log(
          `${isDryRun ? 'Would install' : 'Installed'} standard UI components via shadcn registry to ${display} (${uiDisplay})`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (command === 'sync-components') {
    const isDryRun = args.includes('--dry-run');
    const isAuto = args.includes('--auto');
    const isForce = args.includes('--force');

    if (isAuto) {
      const workflowDir = path.join(process.cwd(), '.github', 'workflows');
      fs.mkdirSync(workflowDir, { recursive: true });
      const workflowPath = path.join(workflowDir, 'dotfiles-sync.yml');

      const workflowContent = `name: Dotfiles Component Sync

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sundays at midnight
  workflow_dispatch: # Allow manual trigger

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Run Component Sync
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          git clone --depth 1 https://github.com/avoidTheLite/dotfiles.git ~/dotfiles
          mkdir -p ~/.local/bin
          ln -s ~/dotfiles/scripts/dotfiles ~/.local/bin/dotfiles
          export PATH="$HOME/.local/bin:$PATH"
          dotfiles sync-components
`;

      fs.writeFileSync(workflowPath, workflowContent, 'utf8');
      console.log('Successfully scaffolded scheduled weekly sync GitHub Action to .github/workflows/dotfiles-sync.yml!');
      process.exit(0);
    }

    const targets = findExistingComponentDirs(process.cwd());
    if (targets.length === 0) {
      console.error('Error: No installed shadcn/dotfiles UI components found.');
      console.error('Please run "dotfiles install-components" (or pass a target directory) first.');
      process.exit(1);
    }

    for (const target of targets) {
      const gitStatusOut = runCmd(`git status --porcelain "${target}"`);
      if (gitStatusOut && gitStatusOut.trim().length > 0) {
        if (!isForce) {
          console.error(`Error: Local directory "${path.relative(process.cwd(), target)}" has uncommitted changes.`);
          console.error('Please commit or stash your changes before syncing, or run with --force to overwrite.');
          process.exit(1);
        }
        console.log('Warning: --force specified. Overwriting uncommitted local changes.');
      }
    }

    const sourceDir = componentsSourceDir(dotfilesRoot);
    const hasLocalRegistry = fs.existsSync(path.join(sourceDir, 'registry.json'));

    if (isDryRun) {
      for (const target of targets) {
        installComponents({
          targetDir: target,
          sourceDir: hasLocalRegistry ? sourceDir : null,
          overwrite: true,
          dryRun: true,
        });
        console.log(`Would re-install shadcn registry components into ${path.relative(process.cwd(), target) || target}`);
      }
      process.exit(0);
    }

    const beforeStatus = runCmd('git status --porcelain') ?? '';
    for (const target of targets) {
      installComponents({
        targetDir: target,
        sourceDir: hasLocalRegistry ? sourceDir : null,
        overwrite: true,
      });
      console.log(`Re-installed shadcn registry components into ${path.relative(process.cwd(), target) || target}`);
    }

    const afterStatus = runCmd('git status --porcelain') ?? '';
    if (afterStatus === beforeStatus) {
      console.log('Component library is already up to date with the shadcn registry.');
      process.exit(0);
    }

    const hasGh = runCmd('which gh');
    if (!hasGh) {
      console.error('Error: "gh" CLI is not installed. Please install it to continue.');
      process.exit(1);
    }

    const ghAuthStatus = runCmd('gh auth status');
    if (ghAuthStatus === null || !ghAuthStatus.includes('Logged in to')) {
      console.error('Error: "gh" CLI is not authenticated. Please run "gh auth login" first.');
      process.exit(1);
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const branchName = `dotfiles-sync/shadcn-registry-${stamp}`;
    console.log(`Creating branch ${branchName}...`);
    const checkoutBranchResult = runCmd(`git checkout -b "${branchName}"`);
    if (checkoutBranchResult === null) {
      runCmd(`git checkout "${branchName}"`);
    }

    for (const target of targets) {
      runCmd(`git add "${target}"`);
    }
    runCmd('git commit -m "chore: sync UI components from the shadcn registry"');
    const pushResult = runCmd(`git push origin "${branchName}"`);
    if (pushResult === null) {
      runCmd(`git push --set-upstream origin "${branchName}"`);
    }

    const prBody = `## Summary
Re-installed the standard UI component library from the dotfiles shadcn registry.

See \`git diff\` on this branch for the file-level changes. Versioning follows the upstream git SHA (\`npx shadcn add avoidTheLite/dotfiles/standard-ui#<sha>\`).
`;
    const tempPrBodyFile = path.join(os.tmpdir(), 'pr-body.md');
    fs.writeFileSync(tempPrBodyFile, prBody, 'utf8');
    const prUrl = runCmd(`gh pr create --title "Sync UI components from the shadcn registry" --body-file "${tempPrBodyFile}"`);
    try { fs.rmSync(tempPrBodyFile, { force: true }); } catch { /* ignore */ }
    if (prUrl) {
      console.log(`\nPull request successfully opened:\n${prUrl}`);
    } else {
      console.error('\nError: Failed to open pull request via "gh pr create".');
    }
    process.exit(0);
  }

  // Scaffolding commands (install/generate)
  try {
    const parsed = parseArgs(args);
    const resolvedConfigPath = parsed.useExample
      ? exampleConfigPath()
      : parsed.configPath
        ? path.resolve(process.cwd(), parsed.configPath)
        : null;
    if (!resolvedConfigPath) {
      throw new Error('Pass --config <file.json> or --example');
    }
    const raw = loadConfig(resolvedConfigPath);
    if (parsed.name) {
      raw.projectName = parsed.name;
    }
    if (parsed.scope) {
      raw.scope = parsed.scope;
    }
    const result = installFromConfig({
      targetDir: parsed.targetDir,
      config: raw,
      dotfilesRoot,
      force: parsed.force || parsed.command === 'generate',
    });
    const normalized = normalizeConfig({ ...raw });
    console.log(
      `Generated ${normalized.projectName} at ${parsed.targetDir} (${result.created.length} files)`,
    );
    console.log('Apps:');
    for (const app of normalized.apps) {
      console.log(`  - ${app.type}: apps/${app.name}`);
    }
    console.log('Next steps:');
    console.log(`  cd "${parsed.targetDir}"`);
    console.log('  pnpm install');
    console.log('  pnpm dev');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
