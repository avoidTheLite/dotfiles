#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

// Helper to recursively list all files in a directory
function getFilesRecursively(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results.push(...getFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

// Helper to display CLI help
function printHelp() {
  console.log(`Dotfiles CLI Interface

Usage:
  dotfiles <command> [options]

Commands:
  install-components <target-dir>   Install standard base components to the target directory
  sync-components                   Pull latest standard base component updates and open a PR

Options:
  --dry-run                         Diff and report only (sync-components only)
  --auto                            Scaffold a scheduled GitHub Action for weekly sync (sync-components only)
  --force                           Force sync even if local vendored directory has uncommitted changes
  -h, --help                        Show this help message
`);
}

// Main execution function
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  if (command === 'install-components') {
    const targetDirArg = args[1];
    if (!targetDirArg) {
      console.error('Error: Please specify a target directory.');
      console.error('Usage: dotfiles install-components <target-dir>');
      process.exit(1);
    }

    const targetDir = path.resolve(process.cwd(), targetDirArg);
    const sourceDir = path.join(dotfilesRoot, 'identity', 'components');

    if (!fs.existsSync(sourceDir)) {
      console.error(`Error: Source components directory not found at ${sourceDir}`);
      process.exit(1);
    }

    // Create target dir
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy components (except .dotfiles-meta.json which we generate/update)
    const files = fs.readdirSync(sourceDir);
    for (const file of files) {
      if (file === '.dotfiles-meta.json') continue;
      const srcFile = path.join(sourceDir, file);
      const destFile = path.join(targetDir, file);
      const stat = fs.statSync(srcFile);

      if (stat.isDirectory()) {
        fs.mkdirSync(destFile, { recursive: true });
        const subFiles = getFilesRecursively(srcFile);
        for (const subFile of subFiles) {
          const relPath = path.relative(srcFile, subFile);
          const subDest = path.join(destFile, relPath);
          fs.mkdirSync(path.dirname(subDest), { recursive: true });
          fs.copyFileSync(subFile, subDest);
        }
      } else {
        fs.copyFileSync(srcFile, destFile);
      }
    }

    // Read dotfiles source meta to get version
    const sourceMetaPath = path.join(sourceDir, '.dotfiles-meta.json');
    let version = '1.4.0';
    let sourceUrl = 'github.com/avoidTheLite/dotfiles';
    if (fs.existsSync(sourceMetaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(sourceMetaPath, 'utf8'));
        version = meta.component_library_version || version;
        sourceUrl = meta.source || sourceUrl;
      } catch {}
    }

    // Write .dotfiles-meta.json in target dir
    const destMetaPath = path.join(targetDir, '.dotfiles-meta.json');
    const targetMeta = {
      component_library_version: version,
      tools_version: version,
      source: sourceUrl,
      last_synced: new Date().toISOString().split('T')[0]
    };
    fs.writeFileSync(destMetaPath, JSON.stringify(targetMeta, null, 2) + '\n', 'utf8');

    console.log(`Successfully installed standard base components to ${targetDirArg} (v${version})!`);
    process.exit(0);
  }

  if (command === 'sync-components') {
    const isDryRun = args.includes('--dry-run');
    const isAuto = args.includes('--auto');
    const isForce = args.includes('--force');

    // 1. Locate local .dotfiles-meta.json recursively from cwd
    const allFiles = getFilesRecursively(process.cwd());
    const localMetaPath = allFiles.find(f => path.basename(f) === '.dotfiles-meta.json' && !f.includes('node_modules') && !f.includes('.git'));

    if (!localMetaPath) {
      console.error('Error: No local .dotfiles-meta.json found in the current working directory hierarchy.');
      console.error('Please run "dotfiles install-components <dir>" to initialize standard components.');
      process.exit(1);
    }

    const vendoredDir = path.dirname(localMetaPath);

    // If --auto flag is provided, scaffold a weekly scheduled GitHub Action
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
          # Fetch dotfiles and run sync
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

    // 2. Read local meta content
    let localMeta;
    try {
      localMeta = JSON.parse(fs.readFileSync(localMetaPath, 'utf8'));
    } catch (err) {
      console.error(`Error: Could not parse local metadata file at ${localMetaPath}`);
      process.exit(1);
    }

    const localVersion = localMeta.component_library_version;
    const sourceUrl = localMeta.source || 'github.com/avoidTheLite/dotfiles';

    if (!localVersion) {
      console.error('Error: "component_library_version" is missing from .dotfiles-meta.json.');
      process.exit(1);
    }

    // 3. Check for uncommitted changes in the local vendored directory
    const gitStatusOut = runCmd(`git status --porcelain "${vendoredDir}"`);
    if (gitStatusOut && gitStatusOut.trim().length > 0) {
      if (!isForce) {
        console.error(`Error: Local directory "${path.relative(process.cwd(), vendoredDir)}" has uncommitted changes.`);
        console.error('Please commit or stash your changes before syncing, or run with --force to overwrite.');
        process.exit(1);
      } else {
        console.log('Warning: --force specified. Overwriting uncommitted local changes.');
      }
    }

    // 4. Fetch/clone latest dotfiles component source
    console.log(`Cloning latest source from ${sourceUrl}...`);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-sync-'));
    
    // Prepare Git remote URL
    const gitRemoteUrl = (sourceUrl.startsWith('http') || sourceUrl.startsWith('/') || sourceUrl.startsWith('.'))
      ? sourceUrl
      : `https://${sourceUrl}.git`;

    const cloneResult = runCmd(`git clone --depth 1 --filter=blob:none --sparse "${gitRemoteUrl}" "${tempDir}"`);
    if (cloneResult === null && !fs.existsSync(path.join(tempDir, '.git'))) {
      console.error(`Error: No network access or failed to clone from source repo: ${gitRemoteUrl}`);
      // Clean up temp dir
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(1);
    }

    const checkoutResult = runCmd(`git sparse-checkout set identity/components`, { cwd: tempDir });
    const sourceComponentsDir = path.join(tempDir, 'identity', 'components');

    if (!fs.existsSync(sourceComponentsDir)) {
      console.error('Error: Source components directory could not be sparse-checked out.');
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(1);
    }

    // 5. Compare versions
    const sourceMetaPath = path.join(sourceComponentsDir, '.dotfiles-meta.json');
    if (!fs.existsSync(sourceMetaPath)) {
      console.error('Error: Source components directory is missing .dotfiles-meta.json.');
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(1);
    }

    let sourceMeta;
    try {
      sourceMeta = JSON.parse(fs.readFileSync(sourceMetaPath, 'utf8'));
    } catch {
      console.error('Error: Could not parse source .dotfiles-meta.json.');
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(1);
    }

    const latestVersion = sourceMeta.component_library_version;
    if (!latestVersion) {
      console.error('Error: "component_library_version" is missing from source .dotfiles-meta.json.');
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(1);
    }

    if (localVersion === latestVersion) {
      console.log(`Component library is up to date (version ${localVersion}).`);
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(0);
    }

    console.log(`New version found: local v${localVersion} -> latest v${latestVersion}`);

    // 6. Diff changed files between local vendored copy and latest source
    const sourceFiles = getFilesRecursively(sourceComponentsDir);
    const changedFilesList = [];
    const addedFilesList = [];

    for (const srcFile of sourceFiles) {
      const relPath = path.relative(sourceComponentsDir, srcFile);
      if (relPath === '.dotfiles-meta.json') continue; // Skip metadata file diff

      const localFile = path.join(vendoredDir, relPath);
      if (!fs.existsSync(localFile)) {
        addedFilesList.push(relPath);
      } else {
        const srcContent = fs.readFileSync(srcFile, 'utf8');
        const localContent = fs.readFileSync(localFile, 'utf8');
        if (srcContent !== localContent) {
          changedFilesList.push(relPath);
        }
      }
    }

    const allDiffs = [...addedFilesList, ...changedFilesList];
    if (allDiffs.length === 0) {
      console.log('No component files have changed between local copy and upstream source.');
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(0);
    }

    // If dry-run: output summary of changes only
    if (isDryRun) {
      console.log('\n--- Dry-Run Summary ---');
      console.log(`Version change: v${localVersion} -> v${latestVersion}`);
      console.log('\nFiles to be added:');
      addedFilesList.forEach(f => console.log(`  + ${f}`));
      console.log('\nFiles to be updated:');
      changedFilesList.forEach(f => console.log(`  M ${f}`));
      console.log('\nNo files were modified locally.');
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(0);
    }

    // 7. Verify gh CLI is installed and authenticated
    const hasGh = runCmd('which gh');
    if (!hasGh) {
      console.error('Error: "gh" CLI is not installed. Please install it to continue.');
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(1);
    }

    const ghAuthStatus = runCmd('gh auth status');
    if (ghAuthStatus === null || ghAuthStatus.includes('Logged in to') === false) {
      console.error('Error: "gh" CLI is not authenticated. Please run "gh auth login" first.');
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(1);
    }

    // 8. Copy changed files into vendored component directory
    for (const srcFile of sourceFiles) {
      const relPath = path.relative(sourceComponentsDir, srcFile);
      if (relPath === '.dotfiles-meta.json') continue;

      const destFile = path.join(vendoredDir, relPath);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(srcFile, destFile);
    }

    // Write updated .dotfiles-meta.json
    const updatedMeta = {
      ...localMeta,
      component_library_version: latestVersion,
      tools_version: latestVersion,
      last_synced: new Date().toISOString().split('T')[0]
    };
    fs.writeFileSync(localMetaPath, JSON.stringify(updatedMeta, null, 2) + '\n', 'utf8');

    // 9. Git operations
    const branchName = `dotfiles-sync/component-library-v${latestVersion}`;
    console.log(`Creating branch ${branchName}...`);

    const checkoutBranchResult = runCmd(`git checkout -b "${branchName}"`);
    if (checkoutBranchResult === null) {
      // Try switching branch if already exists
      runCmd(`git checkout "${branchName}"`);
    }

    console.log('Staging files...');
    runCmd(`git add "${vendoredDir}"`);

    console.log('Committing changes...');
    runCmd(`git commit -m "chore: sync component library to v${latestVersion}"`);

    console.log('Pushing branch...');
    const pushResult = runCmd(`git push origin "${branchName}"`);
    if (pushResult === null) {
      // Try with set upstream
      runCmd(`git push --set-upstream origin "${branchName}"`);
    }

    // 10. Open pull request via `gh pr create`
    console.log('Opening pull request...');
    const prTitle = `Sync component library to v${latestVersion}`;
    
    // Construct markdown list of changed files
    let prBody = `## Summary\nSuccessfully synced the pre-configured standard UI component library from dotfiles to **v${latestVersion}**.\n\n### Changes\n`;
    if (addedFilesList.length > 0) {
      prBody += `#### Added:\n`;
      addedFilesList.forEach(f => { prBody += `- \`${f}\`\n`; });
    }
    if (changedFilesList.length > 0) {
      prBody += `#### Updated:\n`;
      changedFilesList.forEach(f => { prBody += `- \`${f}\`\n`; });
    }
    prBody += `\nFor more details, see the upstream dotfiles commit log or repository.`;

    const tempPrBodyFile = path.join(os.tmpdir(), 'pr-body.md');
    fs.writeFileSync(tempPrBodyFile, prBody, 'utf8');

    const prUrl = runCmd(`gh pr create --title "${prTitle}" --body-file "${tempPrBodyFile}"`);
    if (prUrl) {
      console.log(`\nPull request successfully opened:\n${prUrl}`);
    } else {
      console.error('\nError: Failed to open pull request via "gh pr create".');
    }

    // Clean up
    try { fs.rmSync(tempPrBodyFile, { force: true }); } catch {}
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

main();
