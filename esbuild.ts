import esbuild from 'esbuild'

esbuild
    .build({
        entryPoints: [
            './src/adminapi/index.ts',
            './src/manager_bot/index.ts',
            './src/notification/index.ts',
        ],
        outdir: 'dist',
        outExtension: {
            '.js': '.mjs',
        },
        bundle: true,
        minify: true,
        sourcemap: true,
        platform: 'node',
        format: 'esm',
        target: ['es2020'],
        loader: { '.ts': 'ts' },
        banner: {
            js: 'import { createRequire } from "module"; import url from "url"; const require = createRequire(import.meta.url); const __filename = url.fileURLToPath(import.meta.url); const __dirname = url.fileURLToPath(new URL(".", import.meta.url));',
        },
    })
    .then(() => {
        console.log('Build succeeded')
    })
    .catch((error) => {
        console.error('Build failed:', error)
    })
