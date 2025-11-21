import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import './index.css'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL || 'http://localhost:3210')

// Clear stale userId if there's a validation error
// This helps recover from the _creationTime validation error
if (typeof window !== 'undefined') {
  const handleError = (event: ErrorEvent) => {
    if (event.error?.message?.includes('ReturnsValidationError') && 
        event.error?.message?.includes('getCurrentUser')) {
      console.warn('Detected validation error, clearing stale userId from localStorage')
      localStorage.removeItem('userId')
      // Reload the page to recover
      window.location.reload()
    }
  }
  window.addEventListener('error', handleError)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" />
      </BrowserRouter>
    </ConvexProvider>
  </React.StrictMode>,
)
