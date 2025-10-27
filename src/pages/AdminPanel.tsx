import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { 
  Database, 
  Trash2, 
  BarChart3, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

export function AdminPanel() {
  const { user } = useAuth()
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Queries
  const stats = useQuery(api.experiments.getDatabaseStats, {})
  
  // Mutations
  const clearEmptyExperiments = useMutation(api.experiments.clearEmptyExperiments)
  const clearAllExperiments = useMutation(api.experiments.clearAllExperiments)
  
  // Check if user is admin (you can customize this logic)
  const isAdmin = user?.email === 'admin@example.com' // Change this to your admin email
  
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600">
            Admin access required
          </p>
        </div>
      </div>
    )
  }

  const handleClearEmpty = async () => {
    setIsLoading(true)
    try {
      const result = await clearEmptyExperiments({})
      toast.success(result.message)
    } catch (error) {
      toast.error('Failed to clear empty experiments')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearAll = async () => {
    if (confirmText !== 'DELETE_ALL_EXPERIMENTS') {
      toast.error('Please type "DELETE_ALL_EXPERIMENTS" to confirm')
      return
    }
    
    setIsLoading(true)
    try {
      const result = await clearAllExperiments({ confirm: confirmText })
      toast.success(result.message)
      setConfirmText('')
    } catch (error) {
      toast.error('Failed to clear all experiments')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Database className="h-8 w-8 mr-3" />
            Database Administration
          </h1>
          <p className="text-gray-600 mt-2">
            Manage experiment data and database cleanup
          </p>
        </div>

        {/* Statistics */}
        <div className="card mb-8">
          <div className="card-header">
            <h2 className="card-title flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Database Statistics
            </h2>
            <p className="card-description">
              Current state of the database
            </p>
          </div>
          <div className="card-content">
            {stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.totalExperiments}
                  </div>
                  <div className="text-sm text-blue-700">Total Experiments</div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.totalPictures}
                  </div>
                  <div className="text-sm text-green-700">Total Pictures</div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.totalUsers}
                  </div>
                  <div className="text-sm text-purple-700">Total Users</div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {stats.emptyExperiments}
                  </div>
                  <div className="text-sm text-red-700">Empty Experiments</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading statistics...
              </div>
            )}
          </div>
        </div>

        {/* Cleanup Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Clear Empty Experiments */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title flex items-center">
                <Trash2 className="h-5 w-5 mr-2" />
                Clear Empty Experiments
              </h2>
              <p className="card-description">
                Remove experiments with no gaze data (failed calibrations)
              </p>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                    <span className="text-sm text-yellow-700">
                      This will delete experiments with empty gaze data (0 gaze points or all points at 0,0)
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={handleClearEmpty}
                  disabled={isLoading}
                  className="btn btn-warning w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Empty Experiments
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Clear All Experiments */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                Clear All Experiments
              </h2>
              <p className="card-description">
                Remove ALL experiment data from the database
              </p>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                    <span className="text-sm text-red-700">
                      ⚠️ DANGER: This will delete ALL experiments permanently!
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type "DELETE_ALL_EXPERIMENTS" to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE_ALL_EXPERIMENTS"
                    className="input w-full"
                  />
                </div>
                
                <button
                  onClick={handleClearAll}
                  disabled={isLoading || confirmText !== 'DELETE_ALL_EXPERIMENTS'}
                  className="btn btn-danger w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All Experiments
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 card">
          <div className="card-header">
            <h2 className="card-title">Safety Information</h2>
          </div>
          <div className="card-content">
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Pictures and users are always preserved during cleanup</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>User experiment counts are automatically updated</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Only experiment data is removed, not the pictures themselves</span>
              </div>
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Empty experiments are those with 0 gaze points or all points at (0,0)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


