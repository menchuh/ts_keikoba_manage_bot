import esbuild from 'esbuild'
import { globbySync } from 'globby'

const entryPoints = globbySync('./src/**/**.ts')

esbuild
    .build({
        entryPoints,
        outdir: 'dist',
        minify: true,
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
