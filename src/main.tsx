import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import './index.css'

// Note: We're NOT clearing localStorage here anymore
// ConvexAuthProvider manages its own token storage, and clearing it
// might interfere with session establishment after sign-in
// If you need to clear stale tokens, do it manually in the browser DevTools

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL || 'http://localhost:3210')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" />
      </BrowserRouter>
    </ConvexAuthProvider>
  </React.StrictMode>,
)
