import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        '.',
        '/Users/atharv/.gemini/antigravity-ide/brain/56923fdf-dd7f-4e0d-858f-3408c823cb4e'
      ]
    }
  },
  define: {
    'process.env': {}
  }
})
