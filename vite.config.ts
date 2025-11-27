import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    // Plugin to replace webgazer dynamic import with script tag loading in production
    {
      name: 'replace-webgazer-import',
      transform(code, id) {
        // Only process webgazerManager in production builds
        if (process.env.NODE_ENV === 'production' && id.includes('webgazerManager.ts')) {
          // Replace the dynamic import with a no-op since we load via script tag
          // The production code path already handles script tag loading
          return code.replace(
            /const\s+webgazerModule\s*=\s*await\s+import\([^)]+webgazer[^)]+\);?\s*wg\s*=\s*webgazerModule\.default\s*\|\|\s*webgazerModule\s+as\s+any\s*console\.log\([^)]+\)/g,
            '// WebGazer loaded via script tag in production - see PROD branch above'
          )
        }
        return null
      }
    },
    // Plugin to copy WebGazer dist files to public so they can be loaded as separate scripts
    {
      name: 'copy-webgazer-dist',
      closeBundle() {
        // Copy WebGazer's built dist file to public so it can be loaded separately
        const webgazerDist = path.resolve(__dirname, '../WebGazer/dist/webgazer.js')
        const publicDist = path.resolve(__dirname, 'dist/webgazer.js')
        
        if (existsSync(webgazerDist)) {
          copyFileSync(webgazerDist, publicDist)
          console.log(`[copy-webgazer] Copied WebGazer dist to ${publicDist}`)
        } else {
          console.warn(`[copy-webgazer] WebGazer dist not found at ${webgazerDist}`)
        }
      }
    }
  ],
  server: {
    port: 3000,
    host: true
  },
  resolve: {
    preserveSymlinks: false,
    alias: {
      // Ensure dependencies are resolved from project root node_modules
      '@tensorflow/tfjs': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs'),
      '@tensorflow-models/face-landmarks-detection': path.resolve(__dirname, 'node_modules/@tensorflow-models/face-landmarks-detection'),
      'localforage': path.resolve(__dirname, 'node_modules/localforage'),
      'regression': path.resolve(__dirname, 'node_modules/regression')
    }
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow-models/face-landmarks-detection',
      'localforage',
      'regression'
    ]
  },
  build: {
    // MINIMAL BUILD CONFIGURATION - No minification, minimal transformations
    // This ensures the code works exactly as in development
    chunkSizeWarningLimit: 5000, // Increase limit since we're not minifying
    
    // Disable minification entirely - just bundle the code
    minify: false,
    
    // Disable source maps for faster builds (can re-enable if needed)
    sourcemap: false,
    
    rollupOptions: {
      // Exclude WebGazer from bundling - we'll load it as a separate script tag
      external: (id) => {
        // Don't bundle WebGazer package - load it as a separate script
        // But DO bundle webgazerManager (our own code)
        // Match the actual package name, not our manager file
        if (id === 'webgazer' || id.startsWith('webgazer/') || id.includes('/WebGazer/') || id.includes('\\WebGazer\\')) {
          return true
        }
        // Don't externalize our own webgazerManager file
        return false
      },
      output: {
        // Minimal code splitting - just split vendor code, keep app code together
        manualChunks: (id) => {
          // Only split very large dependencies
          if (id.includes('@tensorflow/tfjs') || id.includes('@tensorflow-models/face-landmarks-detection')) {
            return 'tensorflow';
          }
          // Keep everything else together to avoid import issues
          return undefined;
        },
        // Preserve original format
        format: 'es',
        // Use hashes for cache busting, but keep names readable
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
      // Disable tree-shaking to preserve all code
      // This ensures nothing gets removed that might be needed
      treeshake: false
    }
  }
})
