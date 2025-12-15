import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Eye, 
  CheckCircle, 
  Clock, 
  XCircle,
  Image as ImageIcon,
  Palette,
  Map,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ValueStudyResults } from '../components/ValueStudyResults'
import { EdgeDetectionResults } from '../components/EdgeDetectionResults'
import { DEBUG_CONFIG } from '../config/debug'
import { analyzeComposition, formatCompositionName } from '../utils/compositionAnalysis'
import { processValueStudy, processEdgeDetection } from '../utils/imageProcessing'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export function PictureExperiments() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const pictureId = searchParams.get('pictureId')
  
  // Collapsible panel states
  const [expandedPanels, setExpandedPanels] = useState<{
    eyeTracking: boolean
    valueStudy: boolean
    edgeDetection: boolean
  }>({
    eyeTracking: false,
    valueStudy: false,
    edgeDetection: false
  })
  
  // Processing states
  const [processingValueStudy, setProcessingValueStudy] = useState(false)
  const [processingEdgeDetection, setProcessingEdgeDetection] = useState(false)
  
  // Client IP for anonymous users
  const [clientIP, setClientIP] = useState<string | null>(null)
  const [ipFetching, setIpFetching] = useState(false)
  useEffect(() => {
    if (!userId && !clientIP && !ipFetching) {
      setIpFetching(true)
      fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => {
          setClientIP(data.ip || 'unknown')
          setIpFetching(false)
        })
        .catch(() => {
          setClientIP('unknown')
          setIpFetching(false)
        })
    } else if (userId) {
      setClientIP(null)
      setIpFetching(false)
    }
  }, [userId, clientIP, ipFetching])
  
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
  const deleteExperiment = useMutation(api.experiments.deleteExperiment)
  const createExperiment = useMutation(api.experiments.createExperiment)
  const updateValueStudyResults = useMutation(api.experiments.updateValueStudyResults)
  const updateEdgeDetectionResults = useMutation(api.experiments.updateEdgeDetectionResults)
  
  const imageUrl = useQuery(
    api.pictures.getImageUrl,
    picture?.fileId ? { fileId: picture.fileId } : 'skip'
  )

  // Get latest experiments
  const valueStudyExps = experiments?.filter(exp => 
    exp.experimentType === 'Value Study' && exp.status === 'completed'
  ) || []
  const latestValueStudy = valueStudyExps.length > 0
    ? valueStudyExps.reduce((latest, current) => 
        current.createdAt > latest.createdAt ? current : latest
      )
    : null

  const edgeDetectionExps = experiments?.filter(exp => 
    exp.experimentType === 'Edge Detection' && exp.status === 'completed'
  ) || []
  const latestEdgeDetection = edgeDetectionExps.length > 0
    ? edgeDetectionExps.reduce((latest, current) => 
        current.createdAt > latest.createdAt ? current : latest
      )
    : null

  const eyeTrackingExps = experiments?.filter(exp => 
    exp.experimentType === 'Eye Tracking' && exp.status === 'completed'
  ) || []

  // Auto-expand panels that have results
  useEffect(() => {
    if (latestValueStudy && !expandedPanels.valueStudy) {
      setExpandedPanels(prev => ({ ...prev, valueStudy: true }))
    }
    if (latestEdgeDetection && !expandedPanels.edgeDetection) {
      setExpandedPanels(prev => ({ ...prev, edgeDetection: true }))
    }
  }, [latestValueStudy, latestEdgeDetection])

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
            onClick={() => navigate('/my-pictures')}
            className="btn btn-primary"
          >
            Back to My Pictures
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
            onClick={() => navigate('/my-pictures')}
            className="btn btn-primary"
          >
            Back to My Pictures
          </button>
        </div>
      </div>
    )
  }

  const togglePanel = (panel: 'eyeTracking' | 'valueStudy' | 'edgeDetection') => {
    setExpandedPanels(prev => ({ ...prev, [panel]: !prev[panel] }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/my-pictures')}
                className="text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {picture.fileName}
                </h1>
                <p className="text-gray-600">
                  Reference analysis and experiments
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Debug Info - controlled by DEBUG_CONFIG.showExperimentDebug */}
        {DEBUG_CONFIG.showExperimentDebug && debugExperiments && debugExperiments.length > 0 && (
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

        {/* Picture Info and Composition */}
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

            {/* Composition Classification Results */}
            {picture.compositionProbabilities ? (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <Palette className="h-5 w-5" />
                  <span>Composition Analysis</span>
                </h3>
                {(() => {
                  const analysis = analyzeComposition(picture.compositionProbabilities as Record<string, number>);
                  
                  const formattedNames = analysis.highlightedCompositions.map(c => formatCompositionName(c));
                  const escapedNames = formattedNames.map(name => 
                    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                  );
                  
                  if (escapedNames.length === 0) {
                    return (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-base text-gray-700 mb-3">{analysis.description}</p>
                        <a
                          href="https://samuelearp.com/blog/composition-ideas/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          <span>Learn more about composition types</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    );
                  }
                  
                  const highlightPattern = new RegExp(`(${escapedNames.join('|')})`, 'gi');
                  const parts: Array<{ text: string; highlight: boolean }> = [];
                  let lastIndex = 0;
                  let match;
                  
                  while ((match = highlightPattern.exec(analysis.description)) !== null) {
                    if (match.index > lastIndex) {
                      parts.push({
                        text: analysis.description.substring(lastIndex, match.index),
                        highlight: false,
                      });
                    }
                    parts.push({
                      text: match[0],
                      highlight: true,
                    });
                    lastIndex = match.index + match[0].length;
                  }
                  
                  if (lastIndex < analysis.description.length) {
                    parts.push({
                      text: analysis.description.substring(lastIndex),
                      highlight: false,
                    });
                  }
                  
                  if (parts.length === 0) {
                    parts.push({
                      text: analysis.description,
                      highlight: false,
                    });
                  }
                  
                  return (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-base text-gray-700 mb-3">
                        {parts.map((part, index) => {
                          if (part.highlight) {
                            return (
                              <span key={index} className="font-semibold text-blue-600">
                                {part.text}
                              </span>
                            );
                          }
                          return <span key={index}>{part.text}</span>;
                        })}
                      </p>
                      <a
                        href="https://samuelearp.com/blog/composition-ideas/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        <span>Learn more about composition types</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>Composition classification in progress...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Experiment Panels */}
        <div className="space-y-4">
          {/* Eye Tracking Panel */}
          <div className="card">
            <div 
              className="card-header cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => togglePanel('eyeTracking')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Eye className={`h-5 w-5 ${eyeTrackingExps.length > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <h2 className="card-title">Eye Tracking</h2>
                    <p className="card-description">
                      {eyeTrackingExps.length > 0 
                        ? `${eyeTrackingExps.length} experiment${eyeTrackingExps.length !== 1 ? 's' : ''} completed`
                        : 'Not yet run'}
                    </p>
                  </div>
                  {eyeTrackingExps.length > 0 && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {eyeTrackingExps.length === 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/eye-tracking-experiment?pictureId=${pictureId}`)
                      }}
                      className="btn btn-sm btn-primary"
                    >
                      Run Experiment
                    </button>
                  )}
                  {expandedPanels.eyeTracking ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
            {expandedPanels.eyeTracking && (
              <div className="card-content">
                {eyeTrackingExps.length > 0 ? (
                  <div className="space-y-4">
                    {eyeTrackingExps.map((exp) => (
                      <div key={exp._id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm text-gray-600">
                              Completed {new Date(exp.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => navigate(`/experiments/${exp._id}`)}
                              className="btn btn-sm btn-primary"
                            >
                              View Results
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm('Are you sure you want to delete this experiment? This action cannot be undone.')) {
                                  try {
                                    await deleteExperiment({
                                      experimentId: exp._id as any,
                                      userId: undefined
                                    })
                                    window.location.reload()
                                  } catch (error: any) {
                                    alert(`Failed to delete experiment: ${error.message || 'Unknown error'}`)
                                  }
                                }
                              }}
                              className="btn btn-sm btn-outline text-red-600 hover:text-red-700 hover:border-red-300"
                              title="Delete experiment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/eye-tracking-experiment?pictureId=${pictureId}`)}
                          className="btn btn-sm btn-outline w-full"
                        >
                          Run New Experiment
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      No eye tracking experiments have been run yet.
                    </p>
                    <button
                      onClick={() => navigate(`/eye-tracking-experiment?pictureId=${pictureId}`)}
                      className="btn btn-primary"
                    >
                      Run Eye Tracking Experiment
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Value Study Panel */}
          <div className="card">
            <div 
              className="card-header cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => togglePanel('valueStudy')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Palette className={`h-5 w-5 ${latestValueStudy ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <h2 className="card-title">Value Study</h2>
                    <p className="card-description">
                      {latestValueStudy 
                        ? `Completed ${new Date(latestValueStudy.createdAt).toLocaleDateString()}`
                        : 'Not yet run'}
                    </p>
                  </div>
                  {latestValueStudy && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {!latestValueStudy && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        // Expand the panel to show the run experiment button inside
                        setExpandedPanels(prev => ({ ...prev, valueStudy: true }))
                      }}
                      className="btn btn-sm btn-primary"
                    >
                      View/Edit
                    </button>
                  )}
                  {expandedPanels.valueStudy ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
            {expandedPanels.valueStudy && (
              <div className="card-content">
                {latestValueStudy && imageUrl && latestValueStudy.results ? (
                  <ValueStudyResults
                    originalImageUrl={imageUrl}
                    initialResults={latestValueStudy.results as any}
                    onSave={async (results) => {
                      try {
                        // Ensure the results structure matches what the mutation expects
                        const formattedResults = {
                          processedImageDataUrl: results.processedImageDataUrl,
                          metadata: {
                            width: results.metadata.width,
                            height: results.metadata.height,
                            diagonal: results.metadata.diagonal,
                            originalFormat: results.metadata.originalFormat
                          },
                          parameters: {
                            levels: results.parameters.levels,
                            smoothness: results.parameters.smoothness,
                            ...(results.parameters.useMedianBlur !== undefined && { useMedianBlur: results.parameters.useMedianBlur }),
                            ...(results.parameters.meanCurvaturePasses !== undefined && { meanCurvaturePasses: results.parameters.meanCurvaturePasses })
                          }
                        }
                        
                        const response = await updateValueStudyResults({
                          experimentId: latestValueStudy._id as any,
                          results: formattedResults,
                          status: 'completed'
                        })
                        
                        if (response.success) {
                          toast.success('Value Study settings saved!')
                        } else {
                          toast.error(response.message || 'Failed to save Value Study settings')
                        }
                      } catch (error: any) {
                        console.error('Save error:', error)
                        toast.error(error.message || 'Failed to save Value Study settings')
                      }
                    }}
                  />
                ) : (
                  <div className="text-center py-8">
                    <Palette className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      No value study has been run yet.
                    </p>
                    <button
                      onClick={async () => {
                        if (!imageUrl || !pictureId || processingValueStudy) return
                        if (!userId && ipFetching) return
                        
                        setProcessingValueStudy(true)
                        try {
                          // Create experiment
                          const result = await createExperiment({
                            pictureId: pictureId as any,
                            userId: userId || undefined,
                            ipAddress: clientIP || undefined,
                            experimentType: 'Value Study',
                            parameters: {
                              autoProcessed: true,
                              defaultLevels: 5,
                            }
                          })
                          
                          // Process image
                          const processingResult = await processValueStudy(imageUrl, {
                            levels: 5,
                          })
                          
                          // Save results
                          await updateValueStudyResults({
                            experimentId: result.experimentId as any,
                            results: processingResult,
                            status: 'completed'
                          })
                          
                          toast.success('Value Study completed!')
                          // The query will automatically refresh and show the results
                        } catch (error: any) {
                          console.error('Value Study error:', error)
                          toast.error(error.message || 'Failed to create Value Study')
                        } finally {
                          setProcessingValueStudy(false)
                        }
                      }}
                      disabled={processingValueStudy || (!userId && ipFetching)}
                      className="btn btn-primary"
                    >
                      {processingValueStudy ? 'Processing...' : 'Run Value Study'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Edge Detection Panel */}
          <div className="card">
            <div 
              className="card-header cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => togglePanel('edgeDetection')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Map className={`h-5 w-5 ${latestEdgeDetection ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <h2 className="card-title">Edge Detection</h2>
                    <p className="card-description">
                      {latestEdgeDetection 
                        ? `Completed ${new Date(latestEdgeDetection.createdAt).toLocaleDateString()}`
                        : 'Not yet run'}
                    </p>
                  </div>
                  {latestEdgeDetection && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {!latestEdgeDetection && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        // Expand the panel to show the run experiment button inside
                        setExpandedPanels(prev => ({ ...prev, edgeDetection: true }))
                      }}
                      className="btn btn-sm btn-primary"
                    >
                      View/Edit
                    </button>
                  )}
                  {expandedPanels.edgeDetection ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
            {expandedPanels.edgeDetection && (
              <div className="card-content">
                {latestEdgeDetection && imageUrl && latestEdgeDetection.results ? (
                  <EdgeDetectionResults
                    originalImageUrl={imageUrl}
                    initialResults={latestEdgeDetection.results as any}
                    onSave={async (results) => {
                      try {
                        // Ensure the results structure matches what the mutation expects
                        const formattedResults = {
                          processedImageDataUrl: results.processedImageDataUrl,
                          metadata: {
                            width: results.metadata.width,
                            height: results.metadata.height,
                            diagonal: results.metadata.diagonal,
                            originalFormat: results.metadata.originalFormat
                          },
                          parameters: {
                            blurRadius: results.parameters.blurRadius,
                            threshold: results.parameters.threshold,
                            ...(results.parameters.invert === true ? { invert: true } : results.parameters.invert === false ? { invert: false } : {})
                          }
                        }
                        
                        const response = await updateEdgeDetectionResults({
                          experimentId: latestEdgeDetection._id as any,
                          results: formattedResults,
                          status: 'completed'
                        })
                        
                        if (response.success) {
                          toast.success('Edge Detection settings saved!')
                        } else {
                          toast.error(response.message || 'Failed to save Edge Detection settings')
                        }
                      } catch (error: any) {
                        console.error('Save error:', error)
                        toast.error(error.message || 'Failed to save Edge Detection settings')
                      }
                    }}
                  />
                ) : (
                  <div className="text-center py-8">
                    <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      No edge detection has been run yet.
                    </p>
                    <button
                      onClick={async () => {
                        if (!imageUrl || !pictureId || processingEdgeDetection) return
                        if (!userId && ipFetching) return
                        
                        setProcessingEdgeDetection(true)
                        try {
                          // Create experiment
                          const result = await createExperiment({
                            pictureId: pictureId as any,
                            userId: userId || undefined,
                            ipAddress: clientIP || undefined,
                            experimentType: 'Edge Detection',
                            parameters: {
                              autoProcessed: true,
                              defaultBlurRadius: 3,
                              defaultThreshold: 3,
                            }
                          })
                          
                          // Process image
                          const processingResult = await processEdgeDetection(imageUrl, {
                            blurRadius: 3,
                            threshold: 3,
                            invert: true
                          })
                          
                          // Save results
                          await updateEdgeDetectionResults({
                            experimentId: result.experimentId as any,
                            results: processingResult,
                            status: 'completed'
                          })
                          
                          toast.success('Edge Detection completed!')
                          // The query will automatically refresh and show the results
                        } catch (error: any) {
                          console.error('Edge Detection error:', error)
                          toast.error(error.message || 'Failed to create Edge Detection')
                        } finally {
                          setProcessingEdgeDetection(false)
                        }
                      }}
                      disabled={processingEdgeDetection || (!userId && ipFetching)}
                      className="btn btn-primary"
                    >
                      {processingEdgeDetection ? 'Processing...' : 'Run Edge Detection'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
