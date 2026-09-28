import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    // Tudo que o main usa vai dentro do bundle: o instalador não precisa levar node_modules.
    // O electron-vite não minifica por padrão; minificado, o app carrega menos código ao abrir.
    build: { minify: true, externalizeDeps: { exclude: ['electron-store', 'electron-updater'] } },
  },
  preload: {
    // Preload com sandbox precisa ser CommonJS.
    build: {
      rollupOptions: {
        external: ['electron'],
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    // O site usa a 5173; assim os dois rodam juntos.
    server: { port: 5174, strictPort: true },
    build: { minify: true },
  },
})
