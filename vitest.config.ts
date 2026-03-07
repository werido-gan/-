import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['components/**/*.test.{ts,tsx}', 'pages/**/*.test.{ts,tsx}', 'services/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'logistics-backend/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**'],
    },
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
