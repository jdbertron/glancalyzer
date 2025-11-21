import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import toast from 'react-hot-toast'

export function useAuth() {
  const [userId, setUserId] = useState<Id<'users'> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const user = useQuery(api.auth.getCurrentUser, userId ? { userId } : 'skip')
  const registerUser = useMutation(api.auth.registerUser)
  const loginUser = useMutation(api.auth.loginUser)
  const verifyEmail = useMutation(api.auth.verifyEmail)

  useEffect(() => {
    // Check for stored user ID in localStorage
    const storedUserId = localStorage.getItem('userId')
    if (storedUserId) {
      setUserId(storedUserId as Id<'users'>)
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, name?: string) => {
    try {
      // First try to login (for verified users)
      try {
        const result = await loginUser({ email })
        setUserId(result.userId)
        localStorage.setItem('userId', result.userId)
        toast.success(result.message)
        return result
      } catch (loginError) {
        // If login fails (user not found or not verified), try to register
        if (loginError instanceof Error && 
            (loginError.message.includes('not found') || 
             loginError.message.includes('not verified'))) {
          // Try to register (will handle unverified users by resending verification)
          const result = await registerUser({ email, name })
          setUserId(result.userId)
          localStorage.setItem('userId', result.userId)
          toast.success(result.message)
          return result
        }
        // Re-throw if it's a different error
        throw loginError
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed')
      throw error
    }
  }

  const logout = () => {
    setUserId(null)
    localStorage.removeItem('userId')
    toast.success('Logged out successfully')
  }

  const verify = async (token: string) => {
    try {
      const result = await verifyEmail({ token })
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      return result
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification failed')
      throw error
    }
  }

  return {
    user,
    userId,
    isLoading,
    login,
    logout,
    verify,
    isAuthenticated: !!userId && !!user?.emailVerified,
  }
}
