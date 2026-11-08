// @ts-check

/**
 * The pre-commit hook runs this serially with `--hide-all`, so every task sees exactly the
 * staged snapshot: unstaged edits and untracked files are hidden until it finishes.
 * @type {import('lint-staged').Configuration}
 */
export default {
  // Ignored files (for example .yarn/releases/*.cjs) can be staged; do not fail on them.
  '*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}': [
    'eslint --fix --no-warn-ignored --max-warnings 0',
    'prettier --write',
  ],
  '*.{json,jsonc,md,yml,yaml,css,html}': 'prettier --write',
  // Runs once per commit, last. Type errors and test failures can come from files that were
  // not staged, so check every workspace affected relative to main.
  '*': () => 'yarn turbo run root:typecheck typecheck test --affected',
};
