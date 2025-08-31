import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: [
            'src/**/*.{test,spec}.{js,ts}',
            'tests/**/*.{test,spec}.{js,ts}',
        ],
        exclude: ['node_modules', 'dist', 'build'],
        coverage: {
            reporter: ['text', 'lcov', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                'src/**/*.d.ts',
                'src/index.ts',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@/types': path.resolve(__dirname, './src/types'),
            '@/utils': path.resolve(__dirname, './src/utils'),
            '@/config': path.resolve(__dirname, './src/config'),
        },
    },
});
