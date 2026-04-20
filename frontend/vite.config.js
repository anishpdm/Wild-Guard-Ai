import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react','react-dom','react-router-dom'],
          'vendor-charts':  ['recharts'],
          'vendor-query':   ['@tanstack/react-query'],
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': { target:'http://localhost:8000', changeOrigin:true, rewrite:p=>p.replace(/^\/api/,'') },
      '/stream': { target:'http://localhost:8000', changeOrigin:true },
      '/ws/live': { target:'ws://localhost:8000', ws:true, changeOrigin:true, rewrite: p=>'/ws' },
      '/ws': { target:'ws://localhost:8000', ws:true, changeOrigin:true },
    },
  },
})