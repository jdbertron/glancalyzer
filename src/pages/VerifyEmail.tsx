import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const { verify } = useAuth()

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (tokenParam) {
      setToken(tokenParam)
      handleVerification(tokenParam)
    }
  }, [searchParams])

  const handleVerification = async (tokenToVerify: string) => {
    setIsVerifying(true)
    try {
      const result = await verify(tokenToVerify)
      setVerificationResult(result)
    } catch (error) {
      setVerificationResult({
        success: false,
        message: 'Verification failed. Please try again.'
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleManualVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    
    setIsVerifying(true)
    try {
      const result = await verify(token)
      setVerificationResult(result)
    } catch (error) {
      setVerificationResult({
        success: false,
        message: 'Verification failed. Please try again.'
      })
    } finally {
      setIsVerifying(false)
    }
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
            Verify your email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Check your email for a verification link
          </p>
        </div>

        {isVerifying ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Verifying your email...</p>
          </div>
        ) : verificationResult ? (
          <div className="text-center">
            {verificationResult.success ? (
              <div>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Email verified successfully!
                </h3>
                <p className="text-gray-600 mb-6">{verificationResult.message}</p>
                <Link
                  to="/dashboard"
                  className="btn btn-primary btn-lg w-full"
                >
                  Go to Dashboard
                </Link>
              </div>
            ) : (
              <div>
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Verification failed
                </h3>
                <p className="text-gray-600 mb-6">{verificationResult.message}</p>
                <div className="space-y-4">
                  <Link
                    to="/login"
                    className="btn btn-primary btn-lg w-full"
                  >
                    Try Again
                  </Link>
                  <Link
                    to="/"
                    className="btn btn-outline btn-lg w-full"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleManualVerification}>
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                Verification Token
              </label>
              <input
                id="token"
                name="token"
                type="text"
                className="input mt-1"
                placeholder="Enter verification token from email"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={!token.trim()}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                Verify Email
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Didn't receive an email? Check your spam folder or{' '}
                <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                  try logging in again
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
