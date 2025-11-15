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
  }
})
