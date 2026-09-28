// ESLint-Konfiguration im Flat-Config-Format (ESLint 9).
// Übernimmt Regeln und Ignores der früheren .eslintrc.json. Die Formatregel
// @typescript-eslint/semi gibt es seit typescript-eslint 8 nicht mehr, sie
// heißt jetzt @stylistic/semi.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default [
    {
        ignores: ['out/**', 'dist/**', 'node_modules/**', '**/*.d.ts', 'temp/**', 'redundant/**']
    },
    js.configs.recommended,
    ...tsPlugin.configs['flat/recommended'],
    security.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: rootDir
            }
        },
        plugins: {
            '@stylistic': stylistic
        },
        rules: {
            '@typescript-eslint/naming-convention': 'warn',
            '@stylistic/semi': 'warn',
            'curly': 'warn',
            'eqeqeq': 'warn',
            'no-throw-literal': 'warn',

            'security/detect-object-injection': 'warn',
            'security/detect-non-literal-fs-filename': 'warn',
            // Vorerst Warnung: meldet über 70 bestehende Regexe. Keiner davon
            // ist exponentiell, einige laufen aber quadratisch. Wieder auf
            // 'error' stellen, sobald sie überarbeitet sind.
            'security/detect-unsafe-regex': 'warn',
            'security/detect-buffer-noassert': 'error',
            'security/detect-child-process': 'warn',
            'security/detect-disable-mustache-escape': 'error',
            'security/detect-eval-with-expression': 'error',
            'security/detect-no-csrf-before-method-override': 'error',
            'security/detect-non-literal-regexp': 'warn',
            'security/detect-non-literal-require': 'warn',
            'security/detect-possible-timing-attacks': 'warn',
            'security/detect-pseudoRandomBytes': 'error',

            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-non-null-assertion': 'warn'
        }
    }
];
