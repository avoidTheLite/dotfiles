import path from 'node:path';
import { pathToFileURL } from 'node:url';

const homeDir = process.env.HOME || process.env.USERPROFILE;

if (!homeDir) {
  throw new Error('Cannot resolve HOME directory for dotfiles Prettier base config.');
}

const baseConfigPath = path.join(homeDir, 'dotfiles', 'prettier', 'prettier.base.js');
const loaded = await import(pathToFileURL(baseConfigPath).href);

export default loaded.default ?? loaded;
