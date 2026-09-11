/**
 * Ports contract for this repo and for generated monorepos.
 * Intended loader order (not wired in generated Vite/Express yet):
 * process.env → config/ports.json → schema defaults.
 * There is no fallback to an example file.
 */
import fs from 'node:fs';
import path from 'node:path';

export const PORTS_RELATIVE = path.join('config', 'ports.json');
export const ENV_EXAMPLE_NAME = '.env.example';

export const ENV_KEYS = {
  web: 'WEB_PORT',
  api: 'API_PORT',
  bind: 'BIND',
};

/**
 * @param {string} dotfilesRoot
 * @returns {string}
 */
export function portsSchemaPath(dotfilesRoot) {
  return path.join(dotfilesRoot, 'identity', 'generation', 'ports.schema.json');
}

/**
 * @param {string} repoRoot
 * @returns {string}
 */
export function portsFilePath(repoRoot) {
  return path.join(repoRoot, PORTS_RELATIVE);
}

/**
 * @param {unknown} schema
 * @returns {{ web: number, api: number, bind: string }}
 */
export function schemaDefaultPorts(schema) {
  if (!schema || typeof schema !== 'object') {
    throw new Error('Ports schema is missing or not an object');
  }
  const properties = /** @type {{ properties?: Record<string, { default?: unknown }> }} */ (
    schema
  ).properties;
  if (!properties?.web || !properties?.api || !properties?.bind) {
    throw new Error('Ports schema must define web, api, and bind');
  }
  const webDefault = properties.web.default;
  const apiDefault = properties.api.default;
  const bindDefault = properties.bind.default;
  if (!Number.isInteger(webDefault) || webDefault < 1 || webDefault > 65535) {
    throw new Error('Ports schema web.default must be an integer 1–65535');
  }
  if (!Number.isInteger(apiDefault) || apiDefault < 1 || apiDefault > 65535) {
    throw new Error('Ports schema api.default must be an integer 1–65535');
  }
  if (typeof bindDefault !== 'string' || bindDefault.trim() === '') {
    throw new Error('Ports schema bind.default must be a non-empty address string');
  }
  return {
    web: webDefault,
    api: apiDefault,
    bind: bindDefault.trim(),
  };
}

/**
 * @param {unknown} value
 * @param {{ web: number, api: number, bind: string }} defaults
 * @returns {{ web: number, api: number, bind: string }}
 */
export function validatePortsObject(value, defaults) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${PORTS_RELATIVE} must be a JSON object`);
  }
  const raw = /** @type {Record<string, unknown>} */ (value);
  const extra = Object.keys(raw).filter((key) => !['web', 'api', 'bind'].includes(key));
  if (extra.length > 0) {
    throw new Error(`${PORTS_RELATIVE} has unknown keys: ${extra.join(', ')}`);
  }
  const web = raw.web === undefined ? defaults.web : raw.web;
  const api = raw.api === undefined ? defaults.api : raw.api;
  const bind = raw.bind === undefined ? defaults.bind : raw.bind;
  for (const [name, port] of [
    ['web', web],
    ['api', api],
  ]) {
    if (!Number.isInteger(port) || Number(port) < 1 || Number(port) > 65535) {
      throw new Error(`${PORTS_RELATIVE} "${name}" must be an integer 1–65535`);
    }
  }
  if (typeof bind !== 'string' || bind.trim() === '') {
    throw new Error(`${PORTS_RELATIVE} "bind" must be a non-empty address string`);
  }
  return { web: Number(web), api: Number(api), bind: bind.trim() };
}

/**
 * @param {{ web: number, api: number, bind: string }} ports
 * @returns {string}
 */
export function formatEnvExample(ports) {
  return [
    '# Copy to .env (gitignored). Intended overrides for config/ports.json; generated Vite/API do not read these yet.',
    `${ENV_KEYS.web}=${ports.web}`,
    `${ENV_KEYS.api}=${ports.api}`,
    `${ENV_KEYS.bind}=${ports.bind}`,
    '',
  ].join('\n');
}

/**
 * Write a structured ports file and dotenv example into a generated repo.
 * @param {{ targetDir: string, ports: { web: number, api: number, bind: string } }} options
 * @returns {string[]}
 */
export function writeGeneratedPorts({ targetDir, ports }) {
  const file = portsFilePath(targetDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(ports, null, 2)}\n`, 'utf8');
  const envExample = path.join(targetDir, ENV_EXAMPLE_NAME);
  fs.writeFileSync(envExample, formatEnvExample(ports), 'utf8');
  return [file, envExample];
}

/**
 * Validate this dotfiles repo's committed ports file against the schema defaults.
 * Missing keys take schema defaults; the file itself must exist.
 * @param {string} repoRoot
 * @returns {{ web: number, api: number, bind: string }}
 */
export function loadAndValidateRepoPorts(repoRoot) {
  const schema = JSON.parse(fs.readFileSync(portsSchemaPath(repoRoot), 'utf8'));
  const defaults = schemaDefaultPorts(schema);
  const file = portsFilePath(repoRoot);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${PORTS_RELATIVE}. Every dotfiles PR must include a valid ports file.`);
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ports = validatePortsObject(parsed, defaults);
  const envPath = path.join(repoRoot, ENV_EXAMPLE_NAME);
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${ENV_EXAMPLE_NAME} (dotenv contract: committed example, gitignored .env)`);
  }
  const envText = fs.readFileSync(envPath, 'utf8');
  for (const [field, envKey] of Object.entries(ENV_KEYS)) {
    const match = envText.match(new RegExp(`^${envKey}=(.+)$`, 'm'));
    if (!match) {
      throw new Error(`${ENV_EXAMPLE_NAME} must set ${envKey}`);
    }
    const expected = String(ports[/** @type {'web' | 'api' | 'bind'} */ (field)]);
    if (match[1].trim() !== expected) {
      throw new Error(`${ENV_EXAMPLE_NAME} ${envKey} must match ${PORTS_RELATIVE} (${expected})`);
    }
  }
  return ports;
}
