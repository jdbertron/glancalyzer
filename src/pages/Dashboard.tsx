import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import { Upload, BarChart3, Image, Clock, CheckCircle } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'

// Component for individual experiment item with thumbnail - compact one-line version
function ExperimentItem({ experiment }: { experiment: any }) {
  const imageUrl = useQuery(api.pictures.getImageUrl, 
    experiment.picture?.fileId ? { fileId: experiment.picture.fileId } : 'skip'
  )
  
  const experimentDate = new Date(experiment.createdAt)
  
  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      {/* Thumbnail */}
      {imageUrl && (
        <div className="flex-shrink-0">
          <img 
            src={imageUrl} 
            alt={experiment.picture?.fileName || 'Experiment image'}
            className="w-12 h-12 object-cover rounded"
          />
        </div>
      )}
      <div className="flex-shrink-0">
        {experiment.status === 'completed' ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : experiment.status === 'failed' ? (
          <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-white text-[10px]">!</span>
          </div>
        ) : (
          <Clock className="h-4 w-4 text-yellow-500" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="text-sm font-medium text-gray-900">
          {experiment.experimentType}
        </span>
        <span className="text-xs text-gray-500">
          {experimentDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
        {experiment.picture && (
          <span className="text-xs text-gray-400 truncate">
            {experiment.picture.fileName}
          </span>
        )}
      </div>
      <Link
        to={`/experiments/${experiment._id}`}
        className="btn btn-outline btn-sm flex-shrink-0"
      >
        View
      </Link>
    </div>
  )
}

export function Dashboard() {
  const { user, userId } = useAuth()
  // Get user's pictures from direct uploads
  const userPictures = useQuery(api.pictures.getUserPictures, userId ? { userId } : 'skip')
  // Get pictures from experiments
  const picturesFromExperiments = useQuery(
    api.pictures.getPicturesFromExperiments, 
    userId ? { userId } : 'skip'
  )
  const experiments = useQuery(api.experiments.getUserExperiments, userId ? { userId } : 'skip')

  // Combine both sources: direct user pictures + pictures from experiments
  // Deduplicate by _id, preferring direct user pictures (they have more complete data)
  const allPictures = (() => {
    if (userPictures === undefined || picturesFromExperiments === undefined) return []
    const userPics = userPictures || []
    const expPics = picturesFromExperiments || []
    
    // Start with user pictures, then add experiment pictures that aren't already included
    const combined: any[] = [...userPics]
    const userPicIds = new Set(userPics.map(p => p._id))
    
    expPics.forEach(expPic => {
      if (!userPicIds.has(expPic._id)) {
        combined.push(expPic)
      }
    })
    
    // Sort by uploadedAt descending (newest first)
    return combined.sort((a, b) => b.uploadedAt - a.uploadedAt)
  })()

  // Handle case where user query might have failed (e.g., validation error)
  // If userId exists but user query completed and returned null, there's likely an error
  // Note: user will be undefined while loading, null if query completed but user not found
  // We check this after the loading check to avoid false positives during initial load

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

  if (userPictures === undefined || picturesFromExperiments === undefined || experiments === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const recentExperiments = experiments.slice(0, 5)

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <Image className="h-8 w-8 text-primary-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Pictures</p>
                  <p className="text-2xl font-bold text-gray-900">{allPictures.length}</p>
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
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Membership</p>
                  <p className="text-lg font-bold text-gray-900 capitalize">{user.membershipTier}</p>
                </div>
              </div>
            </div>
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
              <div className="space-y-2">
                {recentExperiments.map((experiment) => (
                  <ExperimentItem key={experiment._id} experiment={experiment} />
                ))}
              </div>
            )}
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
                  to="/my-pictures"
                  className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <Image className="h-6 w-6 text-primary-600" />
                  <div>
                    <p className="font-medium text-gray-900">My Pictures</p>
                    <p className="text-sm text-gray-500">Manage your images</p>
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
