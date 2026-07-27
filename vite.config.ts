import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Base path para GitHub Pages — deve ser o nome exato do repositório
  base: '/empirehub-testes/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
