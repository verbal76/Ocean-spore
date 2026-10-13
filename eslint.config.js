const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  { ignores: ['dist/**', 'dist-ci/**', 'dist-apk/**', 'dist-desktop*/**', 'desktop/app/**', 'desktop/node_modules/**', 'android/**', 'ios/**', 'node_modules/**', 'src/__generated__/**'] },
  {
    // Metro resolves static assets only through require(); tests load CJS scripts.
    files: ['src/render3d/assets.ts', 'src/ui/BrandSplash.tsx', 'src/ui/SplashScreen.tsx', 'src/__tests__/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Electron shell: plain Node CommonJS.
    files: ['desktop/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { __dirname: 'readonly', process: 'readonly', require: 'readonly', module: 'writable', Response: 'readonly', URL: 'readonly', console: 'readonly' } },
  },
  {
    rules: {
      // Hooks rules stay on; stale closures here were real bugs.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
