const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
    {
        ignores: ['jci/**', 'node_modules/**', 'server/data/user-settings.json']
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: globals.node
        },
        rules: {
            'no-console': 'off',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
        }
    },
    {
        // Runs in the browser next to the firmware GUI (see ui-polyfills.html).
        files: ['server/ui-wayland.js'],
        languageOptions: {
            sourceType: 'script',
            globals: {
                ...globals.browser,
                VideoDecoder: 'readonly',
                EncodedVideoChunk: 'readonly'
            }
        }
    },
    prettier
];
