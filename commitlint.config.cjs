/**
 * Commitlint 配置：限定提交信息的类型与格式。
 */
const allowedTypes = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'docs',
  'style',
  'test',
  'build',
  'revert',
  'ci',
  'chore',
  'release',
  'workflow',
];

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', allowedTypes],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
  prompt: {
    messages: {},
  },
};
