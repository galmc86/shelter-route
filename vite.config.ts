import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'

// Generate a content hash of shelters.json for cache-busting
function shelterDataVersion(): string {
  try {
    const data = readFileSync('public/shelters.json')
    return createHash('md5').update(data).digest('hex').slice(0, 8)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to read public/shelters.json for cache-busting: ${reason}`, {
      cause: err,
    })
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/leaflet/')) {
            return 'vendor-leaflet';
          }
          if (id.includes('node_modules/@googlemaps')) {
            return 'vendor-maps';
          }
        },
      },
    },
  },
})
