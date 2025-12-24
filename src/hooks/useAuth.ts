import { useState, useEffect, useRef } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '../../convex/_generated/api'
import toast from 'react-hot-toast'

export function useAuth() {
  const { isLoading, isAuthenticated: convexIsAuthenticated } = useConvexAuth()
  const { signIn, signOut } = useAuthActions()
  
  // Track login state - set immediately on login, cleared on logout
  // This allows UI to update immediately without waiting for async queries
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  
  // WORKAROUND: Extract sessionId from JWT token in localStorage
  // This bypasses the WebSocket authentication issue
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null) // Track current sessionId for closure
  
  // Update ref when sessionId changes
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])
  
  // Extract sessionId from JWT token in localStorage
  // This function searches all localStorage keys for Convex Auth tokens
  const extractSessionId = () => {
    try {
      if (typeof window === 'undefined') return null
      
      // Debug: Log all localStorage keys to help diagnose
      const allKeys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) allKeys.push(key)
      }
      console.log('[useAuth] All localStorage keys:', allKeys)
      
      // Search for any localStorage key that contains 'convexAuthJWT' or similar
      // The key format is typically: __convexAuthJWT_<deployment-url>
      const maxKeys = localStorage.length
      for (let i = 0; i < maxKeys; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        
        // Check for Convex Auth JWT key - be more permissive
        // Look for keys that contain both 'convex' and ('jwt' or 'auth')
        const hasConvex = key.toLowerCase().includes('convex')
        const hasJWT = key.toLowerCase().includes('jwt')
        const hasAuth = key.toLowerCase().includes('auth')
        const isConvexAuthJWT = hasConvex && (hasJWT || hasAuth)
        
        console.log('[useAuth] Checking key:', key, 'hasConvex:', hasConvex, 'hasJWT:', hasJWT, 'hasAuth:', hasAuth, 'isConvexAuthJWT:', isConvexAuthJWT)
        
        if (isConvexAuthJWT) {
          console.log('[useAuth] Found potential Convex Auth JWT key:', key)
          const value = localStorage.getItem(key)
          console.log('[useAuth] Value length:', value?.length)
          
          if (value && value.length > 50) { // JWTs are typically longer
            try {
              // Try to parse as JWT (format: header.payload.signature)
              const parts = value.split('.')
              console.log('[useAuth] JWT parts count:', parts.length)
              
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]))
                console.log('[useAuth] JWT payload:', payload)
                console.log('[useAuth] JWT payload.sub:', payload.sub)
                
                // The sub field contains userId|sessionId
                const sub = payload.sub as string
                if (sub && typeof sub === 'string') {
                  console.log('[useAuth] sub type:', typeof sub, 'sub value:', sub)
                  
                  if (sub.includes('|')) {
                    const parts = sub.split('|')
                    console.log('[useAuth] sub split into parts:', parts)
                    const extractedSessionId = parts[1] // Get the sessionId part after the |
                    console.log('[useAuth] Extracted sessionId from sub:', extractedSessionId)
                    
                    // Use ref to check current value (avoids closure issue)
                    if (extractedSessionId && extractedSessionId !== sessionIdRef.current) {
                      setSessionId(extractedSessionId as any)
                      console.log('[useAuth] ✅ Successfully extracted sessionId:', extractedSessionId, 'from key:', key)
                      return extractedSessionId
                    } else if (extractedSessionId === sessionIdRef.current) {
                      console.log('[useAuth] sessionId already set, skipping')
                      return extractedSessionId // Return it anyway since we have it
                    }
                  } else {
                    console.log('[useAuth] ⚠️ JWT sub field does not contain | separator. sub:', sub)
                    console.log('[useAuth] sub includes check:', sub.includes('|'))
                  }
                } else {
                  console.log('[useAuth] ⚠️ JWT payload.sub is not a string:', typeof sub, sub)
                }
              } else {
                console.log('[useAuth] ⚠️ JWT does not have 3 parts, has:', parts.length)
              }
            } catch (e) {
              // Not a JWT, continue searching
              console.log('[useAuth] ❌ Failed to parse as JWT:', e)
              continue
            }
          } else {
            console.log('[useAuth] ⚠️ Value too short to be a JWT. Length:', value?.length)
          }
        }
      }
      
      // If we didn't find it and had a sessionId before, log a warning
      if (sessionIdRef.current) {
        console.warn('[useAuth] ⚠️ Could not find JWT token in localStorage, sessionId lost')
      } else {
        console.log('[useAuth] No sessionId found in localStorage (this is normal if not logged in)')
      }
    } catch (error) {
      console.error('[useAuth] ❌ Error extracting sessionId:', error)
    }
    
    return null
  }
  
  // Check if user is logged in by checking for JWT token in localStorage
  const checkIfLoggedIn = (): boolean => {
    try {
      if (typeof window === 'undefined') return false
      
      // Check for Convex Auth JWT token
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        
        const hasConvex = key.toLowerCase().includes('convex')
        const hasJWT = key.toLowerCase().includes('jwt')
        const hasAuth = key.toLowerCase().includes('auth')
        const isConvexAuthJWT = hasConvex && (hasJWT || hasAuth)
        
        if (isConvexAuthJWT) {
          const value = localStorage.getItem(key)
          if (value && value.length > 50) {
            return true
          }
        }
      }
    } catch (error) {
      console.error('[useAuth] Error checking login status:', error)
    }
    return false
  }
  
  // Extract sessionId on mount and check login status
  useEffect(() => {
    // Try immediately
    extractSessionId()
    
    // Check if user is logged in based on localStorage
    const loggedIn = checkIfLoggedIn()
    setIsAuthenticated(loggedIn)
    
    // Also try a few times with delays (in case token is stored asynchronously)
    let attempts = 0
    const maxAttempts = 3
    const retryInterval = setInterval(() => {
      attempts++
      if (!sessionIdRef.current && attempts < maxAttempts) {
        extractSessionId()
      } else {
        clearInterval(retryInterval)
      }
    }, 1000) // Check every 1 second, max 3 times
    
    return () => {
      clearInterval(retryInterval)
    }
  }, []) // Only run on mount
  
  // Listen for storage changes (in case token is updated from another window/tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && (e.key.includes('convex') || e.key.includes('auth'))) {
        console.log('[useAuth] Storage changed (from another window), re-extracting sessionId')
        extractSessionId()
        // Update login state based on current localStorage
        const loggedIn = checkIfLoggedIn()
        setIsAuthenticated(loggedIn)
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])
  
  
  // Also extract sessionId when isAuthenticated changes (after sign-in)
  useEffect(() => {
    if (isAuthenticated) {
      // Wait a bit for token to be stored, then extract
      setTimeout(() => {
        extractSessionId()
      }, 500)
      // Update login state
      setIsAuthenticated(true)
    }
  }, [isAuthenticated])
  
  // Try to get user via WebSocket (normal way - might fail due to auth bug)
  const userFromWebSocket = useQuery(api.users.viewer)
  
  // WORKAROUND: Also try to get user via sessionId (bypasses WebSocket auth)
  // This query takes sessionId as an argument and manually looks up the session,
  // bypassing the broken getAuthUserId mechanism
  // Type assertion needed until Convex regenerates API types
  const userFromSessionId = useQuery(
    (api.users as any).getViewerFromSessionId,
    sessionId ? { sessionId: sessionId as any } : 'skip'
  )
  
  // Log for debugging
  useEffect(() => {
    console.log('[useAuth] sessionId:', sessionId)
    console.log('[useAuth] userFromWebSocket:', userFromWebSocket?._id || 'null')
    console.log('[useAuth] userFromSessionId:', userFromSessionId?._id || 'null')
  }, [sessionId, userFromWebSocket, userFromSessionId])
  
  // WORKAROUND: Prioritize sessionId-based user since WebSocket auth is broken
  // Only use WebSocket user if we don't have a sessionId (shouldn't happen after login)
  const user = sessionId ? (userFromSessionId || userFromWebSocket) : userFromWebSocket

  const login = async (email: string, password: string) => {
    try {
      // Use FormData like the official example
      const formData = new FormData()
      formData.set('email', email)
      formData.set('password', password)
      formData.set('flow', 'signIn')
      
      console.log('Calling signIn with provider: password')
      const result = await signIn('password', formData)
      console.log('SignIn result:', result)
      console.log('SignIn result type:', typeof result)
      console.log('SignIn result keys:', result ? Object.keys(result) : 'null')
      console.log('SignIn result stringified:', JSON.stringify(result))
      
      // Set login state immediately - UI will update right away
      setIsAuthenticated(true)
      
      // After sign-in, extract the new sessionId from the token
      // This allows the workaround query to work
      if (typeof window !== 'undefined') {
        // Try immediately
        extractSessionId()
        // Also try with a short delay in case token storage is slightly async
        setTimeout(() => {
          extractSessionId()
        }, 100)
      }
      
      toast.success('Login successful')
      // Return the result so the caller can handle navigation
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      toast.error(message)
      // Clear login state on error
      setIsAuthenticated(false)
      throw error
    }
  }

  const register = async (email: string, password: string, name?: string) => {
    try {
      // Use FormData like the official example
      const formData = new FormData()
      formData.set('email', email)
      formData.set('password', password)
      formData.set('flow', 'signUp')
      if (name) {
        formData.set('name', name)
      }
      
      await signIn('password', formData)
      
      // Set login state immediately - UI will update right away
      setIsAuthenticated(true)
      
      // After registration, extract the new sessionId from the token
      if (typeof window !== 'undefined') {
        // Try immediately
        extractSessionId()
        // Also try with a short delay in case token storage is slightly async
        setTimeout(() => {
          extractSessionId()
        }, 100)
      }
      
      toast.success('Registration successful')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      toast.error(message)
      // Clear login state on error
      setIsAuthenticated(false)
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut()
      // Clear sessionId and login state on logout
      setSessionId(null)
      sessionIdRef.current = null
      setIsAuthenticated(false)
      toast.success('Logged out successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed'
      toast.error(message)
    }
  }

  return {
    user,
    userId: user?._id ?? null,
    isLoading,
    isAuthenticated, // State-based login status - updates immediately on login/logout
    login,
    register,
    logout,
  }
}

