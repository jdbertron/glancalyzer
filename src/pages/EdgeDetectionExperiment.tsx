import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { processEdgeDetection, EdgeDetectionParameters } from '../utils/imageProcessing'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

export function EdgeDetectionExperiment() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const pictureId = searchParams.get('pictureId')
  
  const [processing, setProcessing] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [experimentId, setExperimentId] = useState<string | null>(null)
  
  const picture = useQuery(
    api.pictures.getPicture,
    pictureId ? { pictureId: pictureId as any } : 'skip'
  )
  
  const imageUrl = useQuery(
    api.pictures.getImageUrl,
    picture?.fileId ? { fileId: picture.fileId } : 'skip'
  )
  
  const createExperiment = useMutation(api.experiments.createExperiment)
  const updateResults = useMutation(api.experiments.updateEdgeDetectionResults)
  
  // Check for existing experiment
  const existingExperiment = useQuery(
    api.experiments.getExistingExperiment,
    pictureId ? { pictureId: pictureId as any, experimentType: 'Edge Detection' } : 'skip'
  )
  
  // Get client IP for anonymous users
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
      // If user is registered, we don't need IP
      setClientIP(null)
      setIpFetching(false)
    }
  }, [userId, clientIP, ipFetching])

  // Redirect back to picture experiments page if experiment already exists
  // This prevents the redirect loop and allows users to adjust settings in the panel
  useEffect(() => {
    if (existingExperiment && existingExperiment.status === 'completed' && pictureId) {
      // Instead of redirecting to experiment details, go back to picture experiments
      // where they can adjust settings in the collapsible panel
      navigate(`/picture-experiments?pictureId=${pictureId}`)
    }
  }, [existingExperiment, navigate, pictureId])

  // Auto-process when image loads (wait for IP if unregistered)
  // Only run if no existing experiment exists
  useEffect(() => {
    if (!imageUrl || !pictureId || processing || experimentId) return
    // Don't run if we're still checking for existing experiment
    if (existingExperiment === undefined) return
    // Don't run if an existing completed experiment was found
    if (existingExperiment && existingExperiment.status === 'completed') return
    // For unregistered users, wait for IP to be fetched
    if (!userId && ipFetching) return
    
    const runProcessing = async () => {
      setProcessing(true)
      setProcessingError(null)
      
      try {
        // Create experiment first
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
        
        setExperimentId(result.experimentId)
        
        // Process image with default parameters
        const processingResult = await processEdgeDetection(imageUrl, {
          blurRadius: 3,
          threshold: 3,
          invert: true
        })
        
        // Save results
        await updateResults({
          experimentId: result.experimentId as any,
          results: processingResult,
          status: 'completed'
        })
        
        toast.success('Edge Detection completed!')
        
        // Navigate back to picture experiments page after a short delay
        setTimeout(() => {
          if (pictureId) {
            navigate(`/picture-experiments?pictureId=${pictureId}`)
          } else {
            navigate(`/experiments/${result.experimentId}`)
          }
        }, 1000)
        
      } catch (error: any) {
        console.error('Processing error:', error)
        setProcessingError(error.message || 'Failed to process image')
        toast.error('Failed to process image')
        
        // Update experiment status to failed if we have an experimentId
        if (experimentId) {
          try {
            await updateResults({
              experimentId: experimentId as any,
              results: {
                processedImageDataUrl: '',
                metadata: { width: 0, height: 0, diagonal: 0, originalFormat: '' },
                parameters: { blurRadius: 3, threshold: 3, invert: true }
              },
              status: 'failed'
            })
          } catch (e) {
            // Ignore update errors
          }
        }
      } finally {
        setProcessing(false)
      }
    }
    
    runProcessing()
  }, [imageUrl, pictureId, processing, experimentId, userId, clientIP, createExperiment, updateResults, navigate, existingExperiment, ipFetching])

  if (!pictureId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Picture Selected
          </h2>
          <p className="text-gray-600 mb-4">
            Please select a picture to process.
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

  if (picture === undefined || imageUrl === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!picture || !imageUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Picture Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            The selected picture could not be loaded.
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => {
              if (pictureId) {
                navigate(`/picture-experiments?pictureId=${pictureId}`)
              } else {
                navigate(-1)
              }
            }}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edge Detection</h1>
          <p className="text-gray-600 mt-2">
            Processing image to extract edges using Laplacian of Gaussian...
          </p>
        </div>

        {/* Processing Status */}
        <div className="card">
          <div className="card-content">
            {processing && (
              <div className="text-center py-12">
                <Loader2 className="h-12 w-12 text-primary-600 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Processing Image
                </h3>
                <p className="text-gray-600">
                  Applying Gaussian blur, Laplacian operator, and thresholding...
                </p>
                <div className="mt-4 text-sm text-gray-500">
                  This may take a few moments for large images.
                </div>
              </div>
            )}

            {processingError && (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Processing Failed
                </h3>
                <p className="text-gray-600 mb-4">{processingError}</p>
                <button
                  onClick={() => {
                    setProcessingError(null)
                    setExperimentId(null)
                    setProcessing(false)
                  }}
                  className="btn btn-primary"
                >
                  Try Again
                </button>
              </div>
            )}

            {!processing && !processingError && (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Processing Complete
                </h3>
                <p className="text-gray-600">
                  Redirecting to results...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Image Preview (while processing) */}
        {imageUrl && (
          <div className="card mt-6">
            <div className="card-content">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Original Image
              </h3>
              <div className="relative">
                <img
                  src={imageUrl}
                  alt="Original"
                  className="w-full h-auto rounded-lg"
                  style={{ maxHeight: '600px', objectFit: 'contain' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

