// Shared ESLint flat config for every game.
// The plugins are injected by the game (see <game>/eslint.config.mjs) so this
// file needs no dependencies of its own and resolves under pnpm's isolated
// node_modules layout.
export default function createConfig({ js, tseslint }) {
    return tseslint.config(
        { ignores: ['dist/**'] },
        js.configs.recommended,
        ...tseslint.configs.recommended,
        {
            files: ['src/**/*.ts'],
            languageOptions: {
                ecmaVersion: 2022,
                sourceType: 'module'
            },
            rules: {
                'no-console': 'error',
                '@typescript-eslint/no-unused-vars': ['error', {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_'
                }]
            }
        }
    );
}
