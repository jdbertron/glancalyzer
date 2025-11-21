import { useState, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Eye, 
  BarChart3, 
  Map, 
  Activity, 
  Download,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EyeTrackingResults } from '../components/EyeTrackingResults'

// Component that loads image dimensions and passes them to EyeTrackingResults
function EyeTrackingResultsWithDimensions({ data, imageUrl }: { data: any, imageUrl: string }) {
  const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number } | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    }
    img.src = imageUrl
  }, [imageUrl])

  if (!imageDimensions) {
    return <LoadingSpinner />
  }

  return (
    <EyeTrackingResults
      data={data}
      imageUrl={imageUrl}
      imageWidth={imageDimensions.width}
      imageHeight={imageDimensions.height}
    />
  )
}

export function ExperimentDetails() {
  const { experimentId } = useParams()
  const navigate = useNavigate()
  const { user, userId } = useAuth()
  
  const experiment = useQuery(
    api.experiments.getExperiment, 
    experimentId ? { experimentId: experimentId as any, userId: userId || undefined } : 'skip'
  )
  
  const picture = useQuery(
    api.pictures.getPicture,
    experiment?.pictureId ? { pictureId: experiment.pictureId } : 'skip'
  )
  
  const imageUrl = useQuery(
    api.pictures.getImageUrl,
    picture?.fileId ? { fileId: picture.fileId } : 'skip'
  )

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-4">
            Please log in to view experiment details
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (experiment === undefined || picture === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Experiment Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            This experiment doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const isEyeTracking = experiment.experimentType === 'Eye Tracking'
  const hasEyeTrackingData = experiment.eyeTrackingData && experiment.status === 'completed'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {experiment.experimentType} Experiment
                </h1>
                <p className="text-gray-600">
                  {picture?.fileName} • {experiment.status}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {experiment.status === 'completed' ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : experiment.status === 'failed' ? (
                <XCircle className="h-6 w-6 text-red-500" />
              ) : (
                <Clock className="h-6 w-6 text-yellow-500" />
              )}
              <span className="text-sm font-medium text-gray-600 capitalize">
                {experiment.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Experiment Info */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="card-title">Experiment Information</h2>
          </div>
          <div className="card-content">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Experiment Type</label>
                  <p className="text-lg font-medium text-gray-900">{experiment.experimentType}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Picture</label>
                  <p className="text-lg font-medium text-gray-900">{picture?.fileName}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{new Date(experiment.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                
                {experiment.completedAt && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Completed</label>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{new Date(experiment.completedAt).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                {experiment.results && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Results Summary</label>
                    <div className="mt-2 space-y-2">
                      {Object.entries(experiment.results).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-sm text-gray-600 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {typeof value === 'number' ? value.toLocaleString() : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {experiment.parameters && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Parameters</label>
                    <div className="mt-2 space-y-2">
                      {Object.entries(experiment.parameters).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-sm text-gray-600 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {typeof value === 'number' ? value.toLocaleString() : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Eye Tracking Results */}
        {isEyeTracking && hasEyeTrackingData && imageUrl ? (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>Eye Tracking Analysis</span>
              </h2>
              <p className="card-description">
                Detailed visualization of eye movement patterns and attention areas
              </p>
            </div>
            <div className="card-content">
              <EyeTrackingResultsWithDimensions
                data={experiment.eyeTrackingData}
                imageUrl={imageUrl}
              />
            </div>
          </div>
        ) : isEyeTracking && !hasEyeTrackingData ? (
          <div className="card">
            <div className="card-content">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Eye Tracking Data Available
                </h3>
                <p className="text-gray-600">
                  This experiment doesn't have eye tracking data yet, or the data is still being processed.
                </p>
              </div>
            </div>
          </div>
        ) : !isEyeTracking ? (
          <div className="card">
            <div className="card-content">
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {experiment.experimentType} Results
                </h3>
                <p className="text-gray-600">
                  This experiment type doesn't have specialized visualization yet.
                </p>
                {experiment.results && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Raw Results:</h4>
                    <pre className="text-sm text-gray-600 overflow-auto">
                      {JSON.stringify(experiment.results, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Export Options */}
        {experiment.status === 'completed' && (
          <div className="card mt-6">
            <div className="card-header">
              <h2 className="card-title">Export Data</h2>
              <p className="card-description">
                Download experiment data in various formats
              </p>
            </div>
            <div className="card-content">
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => {
                    const dataStr = JSON.stringify(experiment, null, 2)
                    const dataBlob = new Blob([dataStr], { type: 'application/json' })
                    const url = URL.createObjectURL(dataBlob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = `experiment-${experimentId}.json`
                    link.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="btn btn-outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </button>
                
                {hasEyeTrackingData && (
                  <button
                    onClick={() => {
                      const dataStr = JSON.stringify(experiment.eyeTrackingData, null, 2)
                      const dataBlob = new Blob([dataStr], { type: 'application/json' })
                      const url = URL.createObjectURL(dataBlob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = `eye-tracking-data-${experimentId}.json`
                      link.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="btn btn-outline"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Export Eye Tracking Data
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
