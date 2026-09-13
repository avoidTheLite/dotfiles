import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dotfilesRoot = path.resolve(__dirname, '..');
const installScript = path.join(dotfilesRoot, 'scripts', 'install.sh');

function runInstall(home) {
  return execFileSync('sh', [installScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      GIT_CONFIG_NOSYSTEM: '1',
    },
  });
}

function makeHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-install-'));
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('shared aliases stay portable (no macOS-only or WSL-only commands)', () => {
  const shared = read(path.join(dotfilesRoot, 'shell', 'aliases.shared'));
  assert.doesNotMatch(shared, /ls\s*=\s*"ls -G/);
  assert.doesNotMatch(shared, /dscacheutil/);
  assert.doesNotMatch(shared, /wslpath|explorer\.exe|clip\.exe|\/mnt\/c\/Users/);
  assert.match(shared, /alias gst=/);
  assert.match(shared, /alias gco=/);
  assert.match(shared, /alias ll=/);
});

test('macOS aliases stay off the GNU/WSL files', () => {
  const linux = read(path.join(dotfilesRoot, 'shell', 'aliases.linux'));
  const wsl = read(path.join(dotfilesRoot, 'shell', 'aliases.wsl'));
  const macos = read(path.join(dotfilesRoot, 'shell', 'aliases.macos'));
  assert.match(macos, /ls -GFh/);
  assert.match(macos, /dscacheutil/);
  assert.doesNotMatch(linux, /ls -G/);
  assert.doesNotMatch(wsl, /ls -G/);
  assert.match(linux, /--color=auto/);
  assert.match(wsl, /wslpath/);
});

test('work vs home is a profile overlay, not an OS split', () => {
  const work = read(path.join(dotfilesRoot, 'shell', 'aliases.work'));
  const home = read(path.join(dotfilesRoot, 'shell', 'aliases.home'));
  const rc = read(path.join(dotfilesRoot, 'shell', 'rc.dotfiles'));
  assert.match(work, /alias work=/);
  assert.doesNotMatch(work, /dscacheutil|wslpath/);
  assert.doesNotMatch(home, /explorer\.exe|wslpath/);
  assert.match(rc, /DOTFILES_PROFILE/);
  assert.match(rc, /aliases\.macos/);
  assert.match(rc, /aliases\.linux/);
  assert.match(rc, /aliases\.wsl/);
});

test('machine install writes shell stub, rc hooks, and git include', () => {
  const home = makeHome();
  const output = runInstall(home);

  assert.match(output, /detected os: linux/);
  assert.match(output, /shell stub: created/);
  assert.match(output, /zshrc hook: created/);
  assert.match(output, /bashrc hook: created/);
  assert.match(output, /git include: created/);

  const stub = read(path.join(home, '.config', 'dotfiles', 'rc'));
  assert.match(stub, new RegExp(`DOTFILES_DIR="${dotfilesRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(stub, /shell\/rc\.dotfiles/);

  const zshrc = read(path.join(home, '.zshrc'));
  const bashrc = read(path.join(home, '.bashrc'));
  assert.match(zshrc, /dotfiles: managed shell aliases/);
  assert.match(bashrc, /dotfiles: managed shell aliases/);
  assert.match(zshrc, /\.config\/dotfiles\/rc/);
  assert.match(bashrc, /\.config\/dotfiles\/rc/);

  const includePath = execFileSync('git', ['config', '--global', '--get', 'include.path'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
  assert.equal(includePath, path.join(dotfilesRoot, 'git', 'gitconfig.shared'));

  const st = execFileSync('git', ['config', '--global', '--get', 'alias.st'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
  assert.equal(st, 'status');

  const lg = execFileSync('git', ['config', '--global', '--get', 'alias.lg'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
  assert.match(lg, /oneline/);
});

test('machine install is idempotent for shell hooks and git include', () => {
  const home = makeHome();
  runInstall(home);
  const second = runInstall(home);

  assert.match(second, /shell stub: already-correct/);
  assert.match(second, /zshrc hook: already-correct/);
  assert.match(second, /bashrc hook: already-correct/);
  assert.match(second, /git include: already-correct/);

  const zshrc = read(path.join(home, '.zshrc'));
  const markerHits = zshrc.split('dotfiles: managed shell aliases').length - 1;
  assert.equal(markerHits, 1);
});

function bashProbe(home, extraEnv = {}) {
  const env = { ...process.env, HOME: home, ...extraEnv };
  if (!Object.hasOwn(extraEnv, 'DOTFILES_PROFILE')) {
    delete env.DOTFILES_PROFILE;
  }
  const script = `
    . "$HOME/.config/dotfiles/rc"
    alias gst
    alias ll
    alias ls
    if alias work >/dev/null 2>&1; then echo WORK_PRESENT; else echo WORK_ABSENT; fi
  `;
  return execFileSync('bash', ['-c', script], { encoding: 'utf8', env });
}

test('sourced rc loads shared + linux aliases, and work profile on demand', () => {
  const home = makeHome();
  runInstall(home);

  const withoutProfile = bashProbe(home);
  assert.match(withoutProfile, /alias gst=/);
  assert.match(withoutProfile, /alias ll=/);
  assert.match(withoutProfile, /--color=auto/);
  assert.match(withoutProfile, /WORK_ABSENT/);

  const withProfile = bashProbe(home, { DOTFILES_PROFILE: 'work' });
  assert.match(withProfile, /WORK_PRESENT/);

  fs.writeFileSync(path.join(home, '.config', 'dotfiles', 'profile'), 'work\n');
  const fromFile = bashProbe(home);
  assert.match(fromFile, /WORK_PRESENT/);
});

test('repo does not grow a competing root install.sh', () => {
  assert.equal(fs.existsSync(path.join(dotfilesRoot, 'install.sh')), false);
  assert.equal(fs.existsSync(installScript), true);
});
