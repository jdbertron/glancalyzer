import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthActions } from '@convex-dev/auth/react'
import { Lock, ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const initialEmail = searchParams.get('email') || ''
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { signIn } = useAuthActions()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate passwords match
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    // Validate password length
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    // Validate code
    if (!code || code.trim().length === 0) {
      toast.error('Please enter the reset code from your email')
      return
    }

    setIsLoading(true)

    try {
      // Password reset verification - use form's FormData directly (matching Convex Auth docs pattern)
      // The form has hidden inputs for flow and email, and visible inputs for code and newPassword
      const formData = new FormData(e.currentTarget as HTMLFormElement)
      
      console.log('[ResetPassword] FormData contents:')
      for (const [key, value] of formData.entries()) {
        console.log(`  ${key}: ${value}`)
      }
      console.log('[ResetPassword] Calling signIn with flow=reset-verification')
      
      await signIn('password', formData)
      
      setIsSuccess(true)
      toast.success('Password has been reset successfully.')
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password'
      console.error('Password reset error:', error)
      toast.error('Invalid code or code has expired. Please request a new one.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Password reset successful!
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Your password has been reset. Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    )
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
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter the code from your email and your new password.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Hidden inputs for flow and email - matching Convex Auth documentation pattern */}
          <input name="flow" type="hidden" value="reset-verification" />
          <input name="email" type="hidden" value={email} />
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email-display" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email-display"
                  type="email"
                  autoComplete="email"
                  required
                  className="input pl-10"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {initialEmail && (
                <p className="mt-1 text-xs text-gray-500">
                  Enter the code sent to this email address
                </p>
              )}
            </div>

            <div>
              <label htmlFor="code" className="sr-only">
                Reset Code
              </label>
              <div className="relative">
                <input
                  id="code"
                  name="code"
                  type="text"
                  required
                  className="input text-center text-2xl tracking-widest font-mono"
                  placeholder="Enter code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
                  maxLength={20}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Enter the code sent to your email
              </p>
            </div>

            <div>
              <label htmlFor="newPassword" className="sr-only">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="input pl-10 pr-10"
                  placeholder="New password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="input pl-10 pr-10"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isLoading ? 'Resetting password...' : 'Reset password'}
            </button>
          </div>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              Request a new code
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
