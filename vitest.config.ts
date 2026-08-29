import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'apps/**/src/**/__tests__/**/*.test.ts',
      'services/**/src/**/__tests__/**/*.test.ts',
      'simulation/**/src/**/__tests__/**/*.test.ts',
      'apps/**/*.test.ts',
      'services/**/*.test.ts',
      'simulation/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
