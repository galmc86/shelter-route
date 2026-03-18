import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'

// Generate a content hash of shelters.json for cache-busting
function shelterDataVersion(): string {
  try {
    const data = readFileSync('public/shelters.json')
    return createHash('md5').update(data).digest('hex').slice(0, 8)
  } catch {
    return Date.now().toString()
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  define: {
    __SHELTER_DATA_VERSION__: JSON.stringify(shelterDataVersion()),
  },
})
