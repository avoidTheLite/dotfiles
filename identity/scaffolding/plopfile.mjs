/**
 * Plop entry used after generators are copied into a generated monorepo.
 * Turborepo reads turbo/generators/config.js; this file keeps `plop` working too.
 */
export { default } from './turbo/generators/config.js';
