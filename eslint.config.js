const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  { ignores: ['dist/**', 'dist-ci/**', 'dist-apk/**', 'android/**', 'ios/**', 'node_modules/**', 'src/__generated__/**'] },
  {
    // Metro resolves static assets only through require(); tests load CJS scripts.
    files: ['src/render3d/assets.ts', 'src/ui/BrandSplash.tsx', 'src/__tests__/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    rules: {
      // Hooks rules stay on; stale closures here were real bugs.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
