import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'build/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*'],
              message: 'Use the @/ source alias for local imports.',
            },
          ],
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: [
      'src/pages/{Dashboard,Reports,Analytics}/**/*.jsx',
      'src/pages/Knowledge/ContextAnalytics.jsx',
      'src/components/{GlobalSearch,GlobalFilterBar}.jsx',
      'src/layout/Topbar.jsx',
    ],
    ignores: ['**/*.test.jsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['useEffect'],
              message:
                'Keep external synchronization in a focused hook; derive UI values during render.',
            },
            {
              name: 'recharts',
              message:
                'Use application chart wrappers from @/components/charts.',
            },
          ],
          patterns: [
            {
              group: ['./*', '../*'],
              message: 'Use the @/ source alias for local imports.',
            },
            {
              group: ['@/services/*', '@tanstack/react-query'],
              message:
                'Consume a domain hook instead of fetching or transforming server data in UI.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  prettier,
];
