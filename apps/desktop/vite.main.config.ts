import { builtinModules } from 'node:module';

import { defineConfig } from 'vite';

const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((moduleName) => `node:${moduleName}`)]);

export default defineConfig({
  build: {
    outDir: 'dist/main',
    emptyOutDir: true,
    lib: {
      entry: 'src/main/main.ts',
      formats: ['es'],
      fileName: () => 'main.js'
    },
    rollupOptions: {
      external: (id) => id === 'electron' || id === 'better-sqlite3' || nodeBuiltins.has(id)
    }
  }
});
