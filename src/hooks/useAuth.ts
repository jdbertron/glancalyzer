import { useConvexAuth, useQuery } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '../../convex/_generated/api'
import toast from 'react-hot-toast'

export function useAuth() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signIn, signOut } = useAuthActions()
  
  // Get the current user's data from our users table
  const user = useQuery(api.users.viewer)

  const login = async (email: string, password: string) => {
    try {
      await signIn('password', { email, password, flow: 'signIn' })
      toast.success('Login successful')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      toast.error(message)
      throw error
    }
  }

  const register = async (email: string, password: string, name?: string) => {
    try {
      const params: Record<string, string> = { email, password, flow: 'signUp' }
      if (name) {
        params.name = name
      }
      await signIn('password', params)
      toast.success('Registration successful')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      toast.error(message)
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut()
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
    isAuthenticated,
    login,
    register,
    logout,
  }
}
