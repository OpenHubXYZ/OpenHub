import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/*.test.{ts,tsx}', 'packages/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'html']
    }
  }
});
