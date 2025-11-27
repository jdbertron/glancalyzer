import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
    // TensorFlow.js is ~1.8MB - this is expected for ML libraries
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split TensorFlow into its own chunk (largest dependency)
          'tensorflow': ['@tensorflow/tfjs', '@tensorflow-models/face-landmarks-detection'],
          // Split React and related libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Split Convex
          'convex': ['convex', 'convex/react'],
        }
      }
    }
  }
})
