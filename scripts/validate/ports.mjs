#!/usr/bin/env node
/**
 * Every PR must keep a structured config/ports.json and matching .env.example.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadAndValidateRepoPorts } from '../lib/ports.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

try {
  const ports = loadAndValidateRepoPorts(root);
  console.log('ports: OK', JSON.stringify(ports));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('ports:', message);
  process.exit(1);
}
