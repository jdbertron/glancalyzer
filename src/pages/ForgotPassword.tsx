import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthActions } from '@convex-dev/auth/react'
import { Mail, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const { signIn } = useAuthActions()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Password reset is handled through signIn action with flow="reset"
      const formData = new FormData()
      formData.set('email', email.trim())
      formData.set('flow', 'reset')
      
      console.log('[ForgotPassword] Calling signIn with flow=reset, email:', email.trim())
      
      // Call signIn action with flow="reset" - this will trigger the email provider
      await signIn('password', formData)
      
      // If we get here, the reset was initiated successfully
      // Redirect to reset password page with email as query parameter
      toast.success('If an account with that email exists, a password reset code has been sent.')
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`)
    } catch (error) {
      // Don't reveal if email exists - show success message anyway and still redirect
      console.error('Error requesting password reset:', error)
      toast.success('If an account with that email exists, a password reset code has been sent.')
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex items-center justify-between mb-6">
            <Link to="/login" className="flex items-center text-primary-600 hover:text-primary-500">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to login
            </Link>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Forgot your password?
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address and we'll send you a code to reset your password.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input pl-10"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send reset code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
