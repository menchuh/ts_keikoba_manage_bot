const esbuild = require('esbuild')

esbuild
    .build({
        entryPoints: [
            'src/adminapi/index.ts',
            'src/manager_bot/index.ts',
            'src/notification/index.ts',
        ],
        outdir: 'dist',
        bundle: true,
        minify: true,
        sourcemap: true,
        platform: 'node',
        target: ['es2020'],
        loader: { '.ts': 'ts' },
    })
    .then(() => {
        console.log('Build succeeded')
    })
    .catch((error) => {
        console.error('Build failed:', error)
    })
