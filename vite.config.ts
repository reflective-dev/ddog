/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

const BFF_PORT = process.env.BFF_PORT ?? '8787'

export default defineConfig({
  plugins: [react()],
  define: {
    // Tags RUM data with the app version so releases are comparable in Datadog.
    'import.meta.env.VITE_DD_VERSION': JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${BFF_PORT}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'server/main.ts',
        'server/tracer.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})
