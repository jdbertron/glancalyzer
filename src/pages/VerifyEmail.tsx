import { Link } from 'react-router-dom'
import { CheckCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function VerifyEmail() {
  const { isAuthenticated } = useAuth()

  // With password auth, email verification is not required
  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">You're all set!</h2>
          <p className="text-gray-600 mb-6">Your account is ready to use.</p>
          <Link to="/dashboard" className="btn btn-primary btn-lg">
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link to="/" className="flex items-center text-primary-600 hover:text-primary-500 mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to home
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Account Verification
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please log in or register to continue
          </p>
        </div>

        <div className="text-center space-y-4">
          <Link to="/login" className="btn btn-primary btn-lg w-full">
            Sign In
          </Link>
          <Link to="/register" className="btn btn-outline btn-lg w-full">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  )
}
