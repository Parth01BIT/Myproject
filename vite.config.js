import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pin CSS minification targets to browser versions that predate CSS
  // Media Queries Level 4's range syntax (`@media (width<=768px)`).
  // Without this, Vite's lightningcss minifier rewrites
  // `@media (max-width: 768px)` into modernized `(width<=768px)` form,
  // which older Safari / Firefox / Chromium builds silently fail to parse —
  // observed in production as the Login page rendering as unstyled block
  // elements (form text in the top-left, no centered card).
  //
  // Vite's lightningcss minifier reads `build.cssTarget` (NOT
  // `css.lightningcss.targets`) to pick which CSS features to downcast. So
  // we override that here. These targets are old enough that MQ-L4 range
  // syntax is NOT emitted, keeping `max-width:` form which works everywhere.
  build: {
    cssTarget: ['chrome95', 'edge95', 'firefox95', 'safari14', 'ios14'],
  },
})
