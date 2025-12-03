import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { minify } from 'terser'

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
    // Plugin to copy and minify WebGazer dist file (to protect your modifications)
    {
      name: 'copy-and-minify-webgazer',
      async closeBundle() {
        const webgazerDist = path.resolve(__dirname, '../WebGazer/dist/webgazer.js')
        const publicDist = path.resolve(__dirname, 'dist/webgazer.js')
        
        if (existsSync(webgazerDist)) {
          // Read the WebGazer file
          const webgazerCode = readFileSync(webgazerDist, 'utf8')
          
          // Minify WebGazer to protect your modifications
          const minified = await minify(webgazerCode, {
            compress: {
              passes: 2,
              unsafe: false, // Keep safe to preserve math precision
              unsafe_math: false, // Critical: preserve Float64 precision
              unsafe_methods: false,
              unsafe_proto: false,
              unsafe_regexp: false,
              keep_infinity: true
            },
            mangle: {
              toplevel: false, // Don't mangle top-level (might break UMD exports)
              reserved: ['webgazer'] // Preserve the webgazer global
            },
            format: {
              comments: false
            }
          })
          
          if (!minified.code || ('error' in minified && minified.error)) {
            const error = 'error' in minified ? minified.error : 'Unknown minification error'
            console.error('[copy-webgazer] Minification error:', error)
            // Fallback to unminified
            copyFileSync(webgazerDist, publicDist)
            console.log(`[copy-webgazer] Copied WebGazer (unminified due to error)`)
          } else {
            writeFileSync(publicDist, minified.code)
            const originalSize = (webgazerCode.length / 1024 / 1024).toFixed(2)
            const minifiedSize = (minified.code.length / 1024 / 1024).toFixed(2)
            console.log(`[copy-webgazer] Minified WebGazer: ${originalSize}MB → ${minifiedSize}MB`)
          }
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
