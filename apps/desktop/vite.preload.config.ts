import { builtinModules } from 'node:module';

import { defineConfig } from 'vite';

const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((moduleName) => `node:${moduleName}`)]);

export default defineConfig({
  build: {
    outDir: 'dist/preload',
    emptyOutDir: true,
    lib: {
      entry: 'src/preload/preload.ts',
      formats: ['cjs'],
      fileName: () => 'preload.cjs'
    },
    rollupOptions: {
      external: (id) => id === 'electron' || nodeBuiltins.has(id)
    }
  }
});
