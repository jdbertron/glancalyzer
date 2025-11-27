import { Link } from 'react-router-dom'
import { Upload, BarChart3, Shield, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-50 to-primary-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Watch the gaze, perfect the frame:{' '}
              <span className="text-primary-600 whitespace-nowrap">Eye Tracking for Artists</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Upload your images and discover where people look first, how they scan content, 
              and what captures their attention using advanced eye tracking technology.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/upload" className="btn btn-primary btn-lg">
                <Upload className="h-5 w-5 mr-2" />
                Start Eye Tracking Analysis
              </Link>
              {!user && (
                <Link to="/register" className="btn btn-outline btn-lg">
                  Create Account for More Features
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Powerful AI Analysis
            </h2>
            <p className="text-lg text-gray-600">
              Unlock the potential of your images with our advanced AI experiments
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Upload className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Easy Upload
              </h3>
              <p className="text-gray-600">
                Simply drag and drop your images or click to upload. 
                Support for all major image formats.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                AI Experiments
              </h3>
              <p className="text-gray-600">
                Run various AI experiments on your images including heatmap, 
                eye tracking and focus detection.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Secure & Private
              </h3>
              <p className="text-gray-600">
                Your images are processed securely and automatically deleted 
                after 7 days for free users.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-lg text-gray-600">
              Start free and upgrade as you need more experiments
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Free</h3>
                <p className="card-description">Perfect for trying out</p>
                <div className="text-3xl font-bold">$0<span className="text-lg font-normal">/month</span></div>
              </div>
              <div className="card-content">
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    3 experiments per week
                  </li>
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    7-day image retention
                  </li>
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    Eye tracking analysis
                  </li>
                </ul>
              </div>
            </div>

            <div className="card border-primary-200 ring-2 ring-primary-100">
              <div className="card-header">
                <h3 className="card-title">Premium</h3>
                <p className="card-description">For serious artists</p>
                <div className="text-3xl font-bold">$2.99<span className="text-lg font-normal">/month</span></div>
              </div>
              <div className="card-content">
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    100 experiments per month
                  </li>
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    Unlimited image retention
                  </li>
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    Eye tracking analysis
                  </li>
                  {/* Future features - uncomment when available:
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    Advanced AI analysis
                  </li>
                  */}
                </ul>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Professional</h3>
                <p className="card-description">For teachers and art schools</p>
                <div className="text-3xl font-bold">$30<span className="text-lg font-normal">/month</span></div>
              </div>
              <div className="card-content">
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    500 experiments per month
                  </li>
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    Unlimited image retention
                  </li>
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    Eye tracking analysis
                  </li>
                  {/* Future features - uncomment when available:
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    All AI analysis features
                  </li>
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    API access
                  </li>
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    Priority support
                  </li>
                  */}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to analyze your images?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join hundreds of users already using Don't Blink Art
          </p>
          <Link to="/upload" className="btn bg-white text-primary-600 hover:bg-gray-100 btn-lg">
            Try It Now (No Signup Required)
          </Link>
        </div>
      </div>
    </div>
  )
}
