import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  // base: subpath do GitHub Pages (nome do repo)
  base: '/empirehub-testes/',

  build: {
    // output vai para docs/ — mesma pasta que o GitHub Pages serve
    outDir: 'docs',
    // não limpa docs/ inteiro no build (preserva arquivos manuais como backups)
    emptyOutDir: true,
  },

  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
