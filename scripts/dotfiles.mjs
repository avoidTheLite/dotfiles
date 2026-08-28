#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFromConfig, normalizeConfig } from './lib/scaffold.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dotfilesRoot = path.resolve(__dirname, '..');

function printHelp() {
  console.log(`Dotfiles CLI

Usage:
  dotfiles install [target-dir] --config <file.json>
  dotfiles generate [target-dir] --config <file.json>
  dotfiles --help

Install copies turbo/plop generators into the target directory, then renders
a monorepo from the JSON config (React app + Node service by default).

Options:
  --config <path>   Path to a JSON object of generator inputs
  --example         Use identity/generation/examples/react-node-monorepo.json
  --name <slug>     Override config.projectName
  --scope <@org>    Override config.scope
  --force           Allow installing into a non-empty directory
  -h, --help        Show this help message

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
  try {
    const parsed = parseArgs(process.argv.slice(2));
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
