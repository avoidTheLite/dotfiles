import path from 'node:path';
import { pathToFileURL } from 'node:url';

const homeDir = process.env.HOME || process.env.USERPROFILE;

if (!homeDir) {
  throw new Error('Cannot resolve HOME directory for dotfiles ESLint base config.');
}

const baseConfigPath = path.join(homeDir, 'dotfiles', 'eslint', 'eslint.base.js');
const loaded = await import(pathToFileURL(baseConfigPath).href);
const baseConfig = loaded.default ?? loaded;

export default [...baseConfig];
