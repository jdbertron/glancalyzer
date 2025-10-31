import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Eye, 
  BarChart3, 
  CheckCircle, 
  Clock, 
  XCircle,
  Image as ImageIcon,
  Download,
  AlertCircle
} from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EyeTrackingResults } from '../components/EyeTrackingResults'

// Component that loads image dimensions and passes them to EyeTrackingResults
function EyeTrackingResultsWithDimensions({ data, imageUrl }: { data: any, imageUrl: string }) {
  const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number } | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)

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

export function PictureExperiments() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const pictureId = searchParams.get('pictureId')
  
  // Add error handling for queries
  const picture = useQuery(
    api.pictures.getPicture,
    pictureId ? { pictureId: pictureId as any } : 'skip'
  )
  
  const experiments = useQuery(
    api.experiments.getPictureExperiments,
    pictureId ? { pictureId: pictureId as any } : 'skip'
  )
  
  // Debug query to see what's in the database
  const debugExperiments = useQuery(
    api.experiments.debugPictureExperiments,
    pictureId ? { pictureId: pictureId as any } : 'skip'
  )
  
  // Cleanup mutation
  const cleanupDuplicates = useMutation(api.experiments.cleanupDuplicateExperiments)
  
  const imageUrl = useQuery(
    api.pictures.getImageUrl,
    picture?.fileId ? { fileId: picture.fileId } : 'skip'
  )

  // Add error boundary for component crashes
  if (experiments === undefined || picture === undefined) {
    return <LoadingSpinner />
  }


  if (!pictureId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Picture Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            No picture ID provided.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="btn btn-primary"
          >
            Upload Image
          </button>
        </div>
      </div>
    )
  }

  if (picture === undefined || experiments === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!picture) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Picture Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            This picture doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="btn btn-primary"
          >
            Upload New Image
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/upload')}
                className="text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Experiments for {picture.fileName}
                </h1>
                <p className="text-gray-600">
                  {experiments.length} experiment{experiments.length !== 1 ? 's' : ''} completed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Debug Info - Remove this after fixing the issue */}
        {debugExperiments && debugExperiments.length > 0 && (
          <div className="card mb-6 bg-yellow-50 border-yellow-200">
            <div className="card-header">
              <h2 className="card-title text-yellow-800">🐛 Debug: Experiments in Database</h2>
              <p className="card-description text-yellow-700">
                Found {debugExperiments.length} experiment(s) for this picture
                {debugExperiments.length > 1 && (
                  <span className="text-red-600 font-medium"> - Duplicates detected!</span>
                )}
              </p>
            </div>
            <div className="card-content">
              <div className="space-y-2">
                {debugExperiments.map((exp, index) => (
                  <div key={exp._id} className="p-3 bg-white rounded border text-sm">
                    <div className="font-medium">Experiment {index + 1}</div>
                    <div>ID: {exp._id}</div>
                    <div>Type: {exp.experimentType}</div>
                    <div>Status: {exp.status}</div>
                    <div>Created: {new Date(exp.createdAt).toLocaleString()}</div>
                    <div>Has Eye Tracking Data: {exp.hasEyeTrackingData ? 'Yes' : 'No'}</div>
                    <div>Gaze Points: {exp.gazePointCount}</div>
                  </div>
                ))}
              </div>
              
              {debugExperiments.length > 1 && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <h3 className="font-medium text-red-800 mb-2">Clean Up Duplicates</h3>
                  <p className="text-red-700 text-sm mb-3">
                    This will keep only the most recent experiment and delete the older duplicates.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        const result = await cleanupDuplicates({ pictureId: pictureId as any })
                        alert(`✅ ${result.message}`)
                        // Refresh the page to see updated results
                        window.location.reload()
                      } catch (error) {
                        console.error('Cleanup failed:', error)
                        alert('❌ Failed to cleanup duplicates')
                      }
                    }}
                    className="btn btn-sm bg-red-600 hover:bg-red-700 text-white"
                  >
                    🗑️ Clean Up Duplicates
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Picture Info */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="card-title flex items-center space-x-2">
              <ImageIcon className="h-5 w-5" />
              <span>Picture Information</span>
            </h2>
          </div>
          <div className="card-content">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">File Details</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div><strong>Name:</strong> {picture.fileName}</div>
                  <div><strong>Uploaded:</strong> {new Date(picture.uploadedAt).toLocaleString()}</div>
                  {picture.fileSize && (
                    <div><strong>Size:</strong> {(picture.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                  )}
                </div>
              </div>
              <div>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={picture.fileName}
                    className="w-full h-48 object-cover rounded-lg shadow-lg"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Experiments List */}
        {experiments.length === 0 ? (
          <div className="card">
            <div className="card-content">
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Experiments Yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Run an eye tracking experiment on this image to see results here.
                </p>
                <button
                  onClick={() => navigate(`/eye-tracking-experiment?pictureId=${pictureId}`)}
                  className="btn btn-primary"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Run Eye Tracking Experiment
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {experiments.map((experiment) => (
              <div key={experiment._id} className="card">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {experiment.status === 'completed' ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : experiment.status === 'failed' ? (
                        <XCircle className="h-6 w-6 text-red-500" />
                      ) : (
                        <Clock className="h-6 w-6 text-yellow-500" />
                      )}
                      <div>
                        <h2 className="card-title">{experiment.experimentType}</h2>
                        <p className="card-description">
                          {experiment.status === 'completed' ? 'Completed' : 
                           experiment.status === 'failed' ? 'Failed' : 'In Progress'} • 
                          {new Date(experiment.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          const dataStr = JSON.stringify(experiment, null, 2)
                          const dataBlob = new Blob([dataStr], { type: 'application/json' })
                          const url = URL.createObjectURL(dataBlob)
                          const link = document.createElement('a')
                          link.href = url
                          link.download = `experiment-${experiment._id}.json`
                          link.click()
                          URL.revokeObjectURL(url)
                        }}
                        className="btn btn-outline btn-sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Eye Tracking Results */}
                {experiment.experimentType === 'Eye Tracking' && 
                 experiment.eyeTrackingData && 
                 experiment.status === 'completed' && (
                  <div className="card-content">
                    {imageUrl && experiment.eyeTrackingData.gazePoints ? (
                      <div>
                        {(() => {
                          try {
                            return (
                              <EyeTrackingResultsWithDimensions
                                data={experiment.eyeTrackingData}
                                imageUrl={imageUrl}
                              />
                            )
                          } catch (error) {
                            console.error('Error rendering EyeTrackingResults:', error)
                            return (
                              <div className="text-center py-4">
                                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                                <p className="text-red-600">Error rendering eye tracking results</p>
                              </div>
                            )
                          }
                        })()}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Eye Tracking Data Available
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {!imageUrl ? 'Image not available for visualization' : 'Eye tracking data format issue'}
                        </p>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">Data Summary</h4>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>Gaze points: {experiment.eyeTrackingData.gazePoints?.length || 0}</div>
                            <div>Fixations: {experiment.eyeTrackingData.fixationPoints?.length || 0}</div>
                            <div>Duration: {experiment.eyeTrackingData.sessionDuration ? Math.round(experiment.eyeTrackingData.sessionDuration / 1000) : 0}s</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Other Experiment Types */}
                {experiment.experimentType !== 'Eye Tracking' && experiment.results && (
                  <div className="card-content">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2">Results</h3>
                      <pre className="text-sm text-gray-600 overflow-auto">
                        {JSON.stringify(experiment.results, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Run New Experiment */}
        <div className="mt-8">
          <div className="card">
            <div className="card-content">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Run Another Experiment
                </h3>
                <p className="text-gray-600 mb-4">
                  Analyze this image with different experiment types
                </p>
                <button
                  onClick={() => navigate(`/eye-tracking-experiment?pictureId=${pictureId}`)}
                  className="btn btn-primary"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Run Eye Tracking Experiment
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
