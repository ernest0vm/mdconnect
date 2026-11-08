// @ts-check

/**
 * Runs on staged files only. Type checks and tests run afterwards in the pre-commit hook via
 * `turbo --affected`, because they depend on files that may not be staged.
 * @type {import('lint-staged').Configuration}
 */
export default {
  '*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}': ['eslint --fix --max-warnings 0', 'prettier --write'],
  '*.{json,jsonc,md,yml,yaml,css,html}': 'prettier --write',
};
