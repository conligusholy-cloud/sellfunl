import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd() + '/..', '')

  // Verze = čas buildu — zapéká se do produkčního kódu při "npm run build"
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const version = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return {
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    plugins: [react()],
    server: {
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          secure: true,
          headers: {
            'x-api-key': env.ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
          }
        }
      }
    }
  }
})