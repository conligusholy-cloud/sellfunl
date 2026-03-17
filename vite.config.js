import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        secure: true,
        headers: {
          'x-api-key': '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',
          'anthropic-version': '2023-06-01',
        }
      }
    }
  }
})