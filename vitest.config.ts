/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
    test: {
        globals: true,
        coverage: {
            reporter: ['text', 'html'],
            include: ['src/**/*.{js,ts}'],
        },
        include: ['./test/**.test.ts'],
        exclude: ['node_modules'],
    },
})
