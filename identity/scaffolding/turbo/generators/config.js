/**
 * Turborepo code generators (Plop). Copied into generated repos as
 * turbo/generators/config.js so `pnpm exec turbo gen` can add more apps later.
 *
 * @param {import('node-plop').NodePlopAPI} plop
 */
export default function generator(plop) {
  plop.setGenerator('frontend_app', {
    description: 'React 18 + Vite + Tailwind frontend app',
    prompts: [
      { type: 'input', name: 'name', message: 'App directory name (under apps/)' },
      { type: 'input', name: 'scope', message: 'Package scope (e.g. @acme)' },
      { type: 'input', name: 'projectName', message: 'Root project name' },
    ],
    actions: [
      {
        type: 'addMany',
        destination: 'apps/{{name}}/',
        base: 'templates/web-frontend',
        templateFiles: 'templates/web-frontend/**/*.hbs',
      },
    ],
  });

  plop.setGenerator('node_backend', {
    description: 'Express 5 TypeScript service',
    prompts: [
      { type: 'input', name: 'name', message: 'App directory name (under apps/)' },
      { type: 'input', name: 'scope', message: 'Package scope (e.g. @acme)' },
      { type: 'input', name: 'projectName', message: 'Root project name' },
    ],
    actions: [
      {
        type: 'addMany',
        destination: 'apps/{{name}}/',
        base: 'templates/node-backend',
        templateFiles: 'templates/node-backend/**/*.hbs',
      },
    ],
  });

  plop.setGenerator('shared_package', {
    description: 'Shared workspace package (tsconfig, types, or util)',
    prompts: [
      {
        type: 'list',
        name: 'packageName',
        message: 'Which shared package?',
        choices: ['tsconfig', 'types', 'util'],
      },
      { type: 'input', name: 'scope', message: 'Package scope (e.g. @acme)' },
      { type: 'input', name: 'projectName', message: 'Root project name' },
    ],
    actions: [
      {
        type: 'addMany',
        destination: 'packages/{{packageName}}/',
        base: 'templates/packages/{{packageName}}',
        templateFiles: 'templates/packages/{{packageName}}/**/*.hbs',
      },
    ],
  });
}
