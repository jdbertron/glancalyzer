/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL?: string
  readonly VITE_DEBUG?: string  // Set to 'true' to enable debug mode in production
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}




































