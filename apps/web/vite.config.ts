import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The browser calls the API on the same origin (/api/v1); in development and preview that is forwarded to the API process.
const proxy = { '/api': { target: 'http://localhost:8000', changeOrigin: false } }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: { proxy },
  preview: { proxy },
})
