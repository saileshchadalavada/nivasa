import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.js', 'tests/*.test.js'],
    exclude: ['tests/**/*.spec.js', 'node_modules/**'],
  },
});
