import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isSample = mode === 'sample';

  return {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: isSample ? 'dist-sample' : 'dist',
      assetsDir: 'assets',
      target: 'es2020',
      rollupOptions: isSample
        ? {
            input: {
              clicker: resolve(__dirname, 'samples/clicker/index.html'),
            },
          }
        : undefined,
    },
    server: {
      port: 3000,
      open: true,
    },
  };
});
