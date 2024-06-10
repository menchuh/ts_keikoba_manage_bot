import js from '@eslint/js'
import typescriptEslintParser from '@typescript-eslint/parser'

export default [
    // lint対象ファイルの設定
    {
        files: ['**/*.{js,ts,mjs,mts,cjs,cts,jsx,tsx}'],
    },
    {
        ignores: ['**/dist/**'],
    },
    // eslintの推奨ルールを使用する
    js.configs.recommended,

    // TypeScriptパーサーの設定
    {
        languageOptions: {
            parser: typescriptEslintParser,
            parserOptions: {
                sourceType: 'module',
                project: './tsconfig.json',
            },
        },
    },

    //  プラグインの設定 (例: typescript-eslintの有効化)
]
