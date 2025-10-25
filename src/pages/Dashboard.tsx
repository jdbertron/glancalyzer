import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import { Upload, BarChart3, Image, Clock, CheckCircle } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'

export function Dashboard() {
  const { user, userId } = useAuth()
  const pictures = useQuery(api.pictures.getUserPictures, userId ? { userId } : 'skip')
  const experiments = useQuery(api.experiments.getUserExperiments, userId ? { userId } : 'skip')

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Please log in to access your dashboard
          </h2>
          <Link to="/login" className="btn btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  if (pictures === undefined || experiments === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const recentPictures = pictures.slice(0, 3)
  const recentExperiments = experiments.slice(0, 5)
  const completedExperiments = experiments.filter(exp => exp.status === 'completed').length

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.name || user.email}!
          </h1>
          <p className="text-gray-600">
            Here's an overview of your pictures and experiments
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <Image className="h-8 w-8 text-primary-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Pictures</p>
                  <p className="text-2xl font-bold text-gray-900">{pictures.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Experiments</p>
                  <p className="text-2xl font-bold text-gray-900">{experiments.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{completedExperiments}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Membership</p>
                  <p className="text-lg font-bold text-gray-900 capitalize">{user.membershipTier}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Recent Pictures */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Pictures</h2>
              <p className="card-description">Your latest uploaded images</p>
            </div>
            <div className="card-content">
              {recentPictures.length === 0 ? (
                <div className="text-center py-8">
                  <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No pictures yet
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Upload your first image to get started
                  </p>
                  <Link to="/upload" className="btn btn-primary">
                    Upload Image
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPictures.map((picture) => (
                    <div key={picture._id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <Image className="h-8 w-8 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {picture.fileName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {picture.experimentCount} experiment{picture.experimentCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Link
                        to={`/experiments?picture=${picture._id}`}
                        className="btn btn-outline btn-sm"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                  <div className="text-center">
                    <Link to="/experiments" className="btn btn-outline">
                      View All Pictures
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Experiments */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Experiments</h2>
              <p className="card-description">Your latest AI analysis results</p>
            </div>
            <div className="card-content">
              {recentExperiments.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No experiments yet
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Upload an image and run your first experiment
                  </p>
                  <Link to="/upload" className="btn btn-primary">
                    Upload Image
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentExperiments.map((experiment) => (
                    <div key={experiment._id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        {experiment.status === 'completed' ? (
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        ) : experiment.status === 'failed' ? (
                          <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
                            <span className="text-white text-xs">!</span>
                          </div>
                        ) : (
                          <Clock className="h-6 w-6 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {experiment.experimentType}
                        </p>
                        <p className="text-sm text-gray-500 capitalize">
                          {experiment.status}
                        </p>
                      </div>
                      <Link
                        to={`/experiments/${experiment._id}`}
                        className="btn btn-outline btn-sm"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                  <div className="text-center">
                    <Link to="/experiments" className="btn btn-outline">
                      View All Experiments
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Quick Actions</h2>
              <p className="card-description">Get started with your next analysis</p>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  to="/upload"
                  className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <Upload className="h-6 w-6 text-primary-600" />
                  <div>
                    <p className="font-medium text-gray-900">Upload Image</p>
                    <p className="text-sm text-gray-500">Add a new picture</p>
                  </div>
                </Link>

                <Link
                  to="/experiments"
                  className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <BarChart3 className="h-6 w-6 text-primary-600" />
                  <div>
                    <p className="font-medium text-gray-900">View Experiments</p>
                    <p className="text-sm text-gray-500">See all your analysis</p>
                  </div>
                </Link>

                <Link
                  to="/profile"
                  className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <div className="h-6 w-6 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">U</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Profile</p>
                    <p className="text-sm text-gray-500">Manage your account</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
