import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
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
  ChevronUp,
  Sparkles
} from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ValueStudyResults } from '../components/ValueStudyResults'
import { EdgeDetectionResults } from '../components/EdgeDetectionResults'
import { DEBUG_CONFIG } from '../config/debug'
import { analyzeComposition, formatCompositionName } from '../utils/compositionAnalysis'
import { processValueStudy, processEdgeDetection } from '../utils/imageProcessing'
import { extractCLIPFeaturesFromUrl } from '../utils/clipFeatures'
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
  const [classifyingComposition, setClassifyingComposition] = useState(false)
  
  // Track experiment IDs that were just created (to wait for query refresh)
  const [pendingValueStudyId, setPendingValueStudyId] = useState<string | null>(null)
  const [pendingEdgeDetectionId, setPendingEdgeDetectionId] = useState<string | null>(null)
  
  // Refs to prevent infinite retries on error
  const hasAttemptedAutoValueStudy = useRef(false)
  const hasAttemptedAutoEdgeDetection = useRef(false)
  
  // Refs to track if we've already auto-expanded panels (so manual collapse works)
  const hasAutoExpandedValueStudy = useRef(false)
  const hasAutoExpandedEdgeDetection = useRef(false)
  
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
  const generateUploadUrl = useMutation(api.pictures.generateUploadUrl)
  const classifyImageFeatures = useAction(api.imageClassification.classifyImageFeatures)
  
  // Helper function to convert data URL to Blob and upload to Convex Storage
  const uploadDataUrlToStorage = useCallback(async (dataUrl: string, fileName: string): Promise<string> => {
    try {
      // Convert data URL to Blob
      const response = await fetch(dataUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch data URL: ${response.statusText}`)
      }
      const blob = await response.blob()
      
      // Generate upload URL
      const uploadUrl = await generateUploadUrl()
      
      // Upload to Convex Storage using POST
      const uploadResult = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/png' },
        body: blob,
      })
      
      if (!uploadResult.ok) {
        const errorText = await uploadResult.text()
        throw new Error(`Upload failed: ${uploadResult.statusText} - ${errorText}`)
      }
      
      const result = await uploadResult.json()
      if (!result.storageId) {
        throw new Error('Upload response missing storageId')
      }
      
      return result.storageId
    } catch (error: any) {
      console.error('Error uploading to storage:', error)
      throw new Error(`Failed to upload image to storage: ${error.message || 'Unknown error'}`)
    }
  }, [generateUploadUrl])
  
  // State to store converted results (storageId -> dataUrl)
  const [convertedResults, setConvertedResults] = useState<{
    valueStudy?: any
    edgeDetection?: any
  }>({})
  
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

  // Get image URLs from storage for saved results (after latestValueStudy/latestEdgeDetection are computed)
  const valueStudyStorageId = latestValueStudy?.results?.processedImageStorageId
  const edgeDetectionStorageId = latestEdgeDetection?.results?.processedImageStorageId
  
  const valueStudyImageUrl = useQuery(
    api.pictures.getImageUrl,
    valueStudyStorageId ? { fileId: valueStudyStorageId as any } : 'skip'
  )
  const edgeDetectionImageUrl = useQuery(
    api.pictures.getImageUrl,
    edgeDetectionStorageId ? { fileId: edgeDetectionStorageId as any } : 'skip'
  )
  
  // Convert storage URLs to data URLs when available (for backward compatibility)
  useEffect(() => {
    const convertUrlToDataUrl = async (url: string | null | undefined): Promise<string | null> => {
      if (!url || typeof url !== 'string') return null
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`)
        }
        const blob = await response.blob()
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('FileReader failed to read blob'))
          reader.readAsDataURL(blob)
        })
      } catch (error) {
        console.error('Failed to convert URL to data URL:', error)
        return null
      }
    }
    
    // Handle Value Study: convert storage ID to data URL if needed
    if (latestValueStudy?.results) {
      const storageId = latestValueStudy.results.processedImageStorageId
      const existingDataUrl = latestValueStudy.results.processedImageDataUrl
      
      // If results already have data URL (old format), use it directly
      if (existingDataUrl && typeof existingDataUrl === 'string') {
        setConvertedResults(prev => {
          // Only update if different to avoid unnecessary re-renders
          if (prev.valueStudy?.processedImageDataUrl !== existingDataUrl) {
            return {
              ...prev,
              valueStudy: latestValueStudy.results
            }
          }
          return prev
        })
      }
      // If results have storage ID (new format), fetch and convert
      else if (storageId) {
        // Check if we already converted this storage ID
        const currentConverted = convertedResults.valueStudy
        if (currentConverted?.processedImageStorageId === storageId && currentConverted?.processedImageDataUrl) {
          // Already converted, skip
          return
        }
        
        // Wait for the image URL query to complete
        if (valueStudyImageUrl === undefined) {
          // Query is still loading, wait for it
          return
        }
        
        if (valueStudyImageUrl && typeof valueStudyImageUrl === 'string') {
          // URL is available, convert it
          convertUrlToDataUrl(valueStudyImageUrl).then(dataUrl => {
            if (dataUrl && latestValueStudy?.results && latestValueStudy.results.processedImageStorageId === storageId) {
              setConvertedResults(prev => ({
                ...prev,
                valueStudy: {
                  ...latestValueStudy.results,
                  processedImageDataUrl: dataUrl
                }
              }))
            }
          }).catch(error => {
            console.error('Error converting Value Study image URL:', error)
          })
        } else if (valueStudyImageUrl === null) {
          // Query returned null - storage ID might be invalid
          console.warn('Value Study storage ID returned null URL:', storageId)
        }
      }
    } else {
      // Clear converted results if no value study exists
      setConvertedResults(prev => {
        if (prev.valueStudy) {
          return { ...prev, valueStudy: undefined }
        }
        return prev
      })
    }
    
    // Handle Edge Detection: convert storage ID to data URL if needed
    if (latestEdgeDetection?.results) {
      const storageId = latestEdgeDetection.results.processedImageStorageId
      const existingDataUrl = latestEdgeDetection.results.processedImageDataUrl
      
      // If results already have data URL (old format), use it directly
      if (existingDataUrl && typeof existingDataUrl === 'string') {
        setConvertedResults(prev => {
          if (prev.edgeDetection?.processedImageDataUrl !== existingDataUrl) {
            return {
              ...prev,
              edgeDetection: latestEdgeDetection.results
            }
          }
          return prev
        })
      }
      // If results have storage ID (new format), fetch and convert
      else if (storageId) {
        const currentConverted = convertedResults.edgeDetection
        if (currentConverted?.processedImageStorageId === storageId && currentConverted?.processedImageDataUrl) {
          return
        }
        
        if (edgeDetectionImageUrl === undefined) {
          return
        }
        
        if (edgeDetectionImageUrl && typeof edgeDetectionImageUrl === 'string') {
          convertUrlToDataUrl(edgeDetectionImageUrl).then(dataUrl => {
            if (dataUrl && latestEdgeDetection?.results && latestEdgeDetection.results.processedImageStorageId === storageId) {
              setConvertedResults(prev => ({
                ...prev,
                edgeDetection: {
                  ...latestEdgeDetection.results,
                  processedImageDataUrl: dataUrl
                }
              }))
            }
          }).catch(error => {
            console.error('Error converting Edge Detection image URL:', error)
          })
        } else if (edgeDetectionImageUrl === null) {
          console.warn('Edge Detection storage ID returned null URL:', storageId)
        }
      }
    } else {
      setConvertedResults(prev => {
        if (prev.edgeDetection) {
          return { ...prev, edgeDetection: undefined }
        }
        return prev
      })
    }
  }, [valueStudyImageUrl, edgeDetectionImageUrl, latestValueStudy, latestEdgeDetection, convertedResults.valueStudy?.processedImageStorageId, convertedResults.edgeDetection?.processedImageStorageId])

  // Reset auto-expand refs when picture changes
  useEffect(() => {
    hasAutoExpandedValueStudy.current = false
    hasAutoExpandedEdgeDetection.current = false
  }, [pictureId])

  // Auto-expand panels that have results (only once when results first appear)
  useEffect(() => {
    if (latestValueStudy && !hasAutoExpandedValueStudy.current) {
      hasAutoExpandedValueStudy.current = true
      setExpandedPanels(prev => ({ ...prev, valueStudy: true }))
    }
    if (latestEdgeDetection && !hasAutoExpandedEdgeDetection.current) {
      hasAutoExpandedEdgeDetection.current = true
      setExpandedPanels(prev => ({ ...prev, edgeDetection: true }))
    }
  }, [latestValueStudy, latestEdgeDetection])

  // Reset attempt refs when panels close or results become available
  useEffect(() => {
    if (!expandedPanels.valueStudy) {
      hasAttemptedAutoValueStudy.current = false
      setPendingValueStudyId(null)
    }
    if (latestValueStudy) {
      hasAttemptedAutoValueStudy.current = false
      // Clear processing state when results become available
      if (processingValueStudy) {
        setProcessingValueStudy(false)
        setPendingValueStudyId(null)
      }
      // Also clear if this is the pending experiment
      if (pendingValueStudyId && latestValueStudy._id === pendingValueStudyId) {
        setProcessingValueStudy(false)
        setPendingValueStudyId(null)
      }
    }
  }, [expandedPanels.valueStudy, latestValueStudy, processingValueStudy, pendingValueStudyId])
  
  useEffect(() => {
    if (!expandedPanels.edgeDetection) {
      hasAttemptedAutoEdgeDetection.current = false
      setPendingEdgeDetectionId(null)
    }
    if (latestEdgeDetection) {
      hasAttemptedAutoEdgeDetection.current = false
      // Clear processing state when results become available
      if (processingEdgeDetection) {
        setProcessingEdgeDetection(false)
        setPendingEdgeDetectionId(null)
      }
      // Also clear if this is the pending experiment
      if (pendingEdgeDetectionId && latestEdgeDetection._id === pendingEdgeDetectionId) {
        setProcessingEdgeDetection(false)
        setPendingEdgeDetectionId(null)
      }
    }
  }, [expandedPanels.edgeDetection, latestEdgeDetection, processingEdgeDetection, pendingEdgeDetectionId])
  
  // Also check if pending experiments appear in the full experiments list (in case latestEdgeDetection/latestValueStudy haven't updated yet)
  useEffect(() => {
    if (pendingValueStudyId && experiments) {
      const foundExperiment = experiments.find(exp => exp._id === pendingValueStudyId && exp.status === 'completed')
      if (foundExperiment) {
        setProcessingValueStudy(false)
        setPendingValueStudyId(null)
      }
    }
  }, [experiments, pendingValueStudyId])
  
  useEffect(() => {
    if (pendingEdgeDetectionId && experiments) {
      const foundExperiment = experiments.find(exp => exp._id === pendingEdgeDetectionId && exp.status === 'completed')
      if (foundExperiment) {
        setProcessingEdgeDetection(false)
        setPendingEdgeDetectionId(null)
      }
    }
  }, [experiments, pendingEdgeDetectionId])

  // Auto-run Value Study when panel opens if no results exist
  useEffect(() => {
    if (
      expandedPanels.valueStudy &&
      !latestValueStudy &&
      imageUrl &&
      pictureId &&
      !processingValueStudy &&
      !hasAttemptedAutoValueStudy.current &&
      (userId || (!ipFetching && clientIP))
    ) {
      // Mark that we've attempted to prevent infinite retries
      hasAttemptedAutoValueStudy.current = true
      
      // Auto-run Value Study
      const runAutoValueStudy = async () => {
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
          
          // Track this experiment ID to wait for query refresh
          setPendingValueStudyId(result.experimentId)
          
          // Process image
          const processingResult = await processValueStudy(imageUrl, {
            levels: 5,
          })
          
          // Upload processed image to storage
          toast.loading('Uploading image...', { id: 'upload-inline' })
          const storageId = await uploadDataUrlToStorage(
            processingResult.processedImageDataUrl,
            `value-study-${result.experimentId}-${Date.now()}.png`
          )
          toast.dismiss('upload-inline')
          
          // Format results with storage ID
          const formattedResults = {
            processedImageStorageId: storageId,
            metadata: processingResult.metadata,
            parameters: processingResult.parameters
          }
          
          // Save results
          const saveResponse = await updateValueStudyResults({
            experimentId: result.experimentId as any,
            results: formattedResults,
            status: 'completed'
          })
          
          if (saveResponse.success) {
            toast.success('Value Study completed!')
            // Don't clear processing state here - let useEffect clear it when query updates
            // The query will automatically refresh and show the results
          } else {
            toast.error(saveResponse.message || 'Failed to save Value Study results')
            setProcessingValueStudy(false)
            setPendingValueStudyId(null)
          }
        } catch (error: any) {
          console.error('Value Study error:', error)
          const errorMessage = error?.message || 'Failed to create Value Study'
          // Check if it's a rate limit error by checking error name or code
          // Primary check: error name/code (should be preserved by Convex)
          // Fallback: message parsing (only if name/code not available)
          const isRateLimitError = error?.name === 'RateLimitError' || 
                                   error?.code === 'RATE_LIMIT_EXCEEDED'
          // Show user-friendly error message with longer duration for rate limits
          if (isRateLimitError) {
            toast.error(errorMessage, { duration: 6000 })
          } else {
            toast.error(errorMessage)
          }
          setProcessingValueStudy(false)
          setPendingValueStudyId(null)
        }
      }
      
      runAutoValueStudy()
    }
  }, [expandedPanels.valueStudy, latestValueStudy, imageUrl, pictureId, processingValueStudy, userId, ipFetching, clientIP, createExperiment, updateValueStudyResults, uploadDataUrlToStorage])

  // Auto-run Edge Detection when panel opens if no results exist
  useEffect(() => {
    if (
      expandedPanels.edgeDetection &&
      !latestEdgeDetection &&
      imageUrl &&
      pictureId &&
      !processingEdgeDetection &&
      !hasAttemptedAutoEdgeDetection.current &&
      (userId || (!ipFetching && clientIP))
    ) {
      // Mark that we've attempted to prevent infinite retries
      hasAttemptedAutoEdgeDetection.current = true
      
      // Auto-run Edge Detection
      const runAutoEdgeDetection = async () => {
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
          
          // Track this experiment ID to wait for query refresh
          setPendingEdgeDetectionId(result.experimentId)
          
          // Process image
          const processingResult = await processEdgeDetection(imageUrl, {
            blurRadius: 3,
            threshold: 3,
          })
          
          // Upload processed image to storage
          toast.loading('Uploading image...', { id: 'upload-inline-ed' })
          const storageId = await uploadDataUrlToStorage(
            processingResult.processedImageDataUrl,
            `edge-detection-${result.experimentId}-${Date.now()}.png`
          )
          toast.dismiss('upload-inline-ed')
          
          // Format results with storage ID
          const formattedResults = {
            processedImageStorageId: storageId,
            metadata: processingResult.metadata,
            parameters: processingResult.parameters
          }
          
          // Save results
          const saveResponse = await updateEdgeDetectionResults({
            experimentId: result.experimentId as any,
            results: formattedResults,
            status: 'completed'
          })
          
          if (saveResponse.success) {
            toast.success('Edge Detection completed!')
            // Don't clear processing state here - let useEffect clear it when query updates
            // The query will automatically refresh and show the results
          } else {
            toast.error(saveResponse.message || 'Failed to save Edge Detection results')
            setProcessingEdgeDetection(false)
            setPendingEdgeDetectionId(null)
          }
        } catch (error: any) {
          console.error('Edge Detection error:', error)
          const errorMessage = error?.message || 'Failed to create Edge Detection'
          // Check if it's a rate limit error by checking error name or code
          // Primary check: error name/code (should be preserved by Convex)
          const isRateLimitError = error?.name === 'RateLimitError' || 
                                   error?.code === 'RATE_LIMIT_EXCEEDED'
          // Show user-friendly error message with longer duration for rate limits
          if (isRateLimitError) {
            toast.error(errorMessage, { duration: 6000 })
          } else {
            toast.error(errorMessage)
          }
          setProcessingEdgeDetection(false)
          setPendingEdgeDetectionId(null)
        }
      }
      
      runAutoEdgeDetection()
    }
  }, [expandedPanels.edgeDetection, latestEdgeDetection, imageUrl, pictureId, processingEdgeDetection, userId, ipFetching, clientIP, createExperiment, updateEdgeDetectionResults, uploadDataUrlToStorage])

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

  const handleClassifyComposition = async () => {
    if (!pictureId || !imageUrl || classifyingComposition) return
    
    try {
      setClassifyingComposition(true)
      toast.loading('Extracting image features...', { id: 'classify' })
      
      let clipFeatures: Float32Array
      try {
        clipFeatures = await extractCLIPFeaturesFromUrl(imageUrl)
      } catch (clipError) {
        toast.error(
          'Unable to analyze image composition. Please check your internet connection and try again.',
          { id: 'classify', duration: 4000 }
        )
        console.error('CLIP extraction error:', clipError)
        return
      }
      
      toast.loading('Classifying image...', { id: 'classify' })
      const classificationResult = await classifyImageFeatures({
        pictureId: pictureId as any,
        clipFeatures: Array.from(clipFeatures),
      })
      
      if (classificationResult.success) {
        // Check if a clear composition was identified
        const probabilities = classificationResult.probabilities as Record<string, number> | undefined
        if (probabilities) {
          const entries = Object.entries(probabilities).sort((a, b) => b[1] - a[1])
          const topComposition = entries[0]?.[0]
          if (topComposition === 'no_composition') {
            toast.success('Analysis completed - no clear composition identified', { id: 'classify' })
          } else {
            toast.success('Composition identified!', { id: 'classify' })
          }
        } else {
          toast.success('Composition analysis completed', { id: 'classify' })
        }
      } else {
        toast.error(classificationResult.error || 'Classification failed', { id: 'classify' })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to classify image', { id: 'classify' })
      console.error('Classification error:', error)
    } finally {
      setClassifyingComposition(false)
    }
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>Composition classification not yet completed</span>
                  </div>
                  {imageUrl && (
                    <button
                      onClick={handleClassifyComposition}
                      disabled={classifyingComposition}
                      className="btn btn-sm btn-primary flex items-center space-x-2"
                    >
                      {classifyingComposition ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span>Classifying...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Classify Composition</span>
                        </>
                      )}
                    </button>
                  )}
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
              className="card-header"
            >
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity flex-1"
                  onClick={() => togglePanel('eyeTracking')}
                >
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
                  <button
                    type="button"
                    onClick={() => togglePanel('eyeTracking')}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    aria-label={expandedPanels.eyeTracking ? 'Collapse panel' : 'Expand panel'}
                  >
                    {expandedPanels.eyeTracking ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
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
              className="card-header"
            >
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity flex-1"
                  onClick={() => togglePanel('valueStudy')}
                >
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
                  <button
                    type="button"
                    onClick={() => togglePanel('valueStudy')}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    aria-label={expandedPanels.valueStudy ? 'Collapse panel' : 'Expand panel'}
                  >
                    {expandedPanels.valueStudy ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            {expandedPanels.valueStudy && (
              <div className="card-content">
                {latestValueStudy && imageUrl && latestValueStudy.results ? (
                  // Check if we have a storage ID that needs conversion but don't have converted data URL yet
                  (latestValueStudy.results.processedImageStorageId && 
                   !convertedResults.valueStudy?.processedImageDataUrl && 
                   !latestValueStudy.results.processedImageDataUrl) ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">Loading Value Study results...</p>
                    </div>
                  ) : (
                    <ValueStudyResults
                      originalImageUrl={imageUrl}
                      initialResults={(() => {
                        // Prefer converted results if available (has data URL)
                        const converted = convertedResults.valueStudy
                        if (converted && converted.processedImageDataUrl) {
                          return converted as any
                        }
                        // If we have raw results with data URL (old format), use them
                        if (latestValueStudy.results.processedImageDataUrl) {
                          return latestValueStudy.results as any
                        }
                        // If we have storage ID but no conversion yet, we should have shown loading above
                        // But if we get here, try to use the raw results (component might handle it)
                        console.warn('Value Study results have storage ID but no converted data URL - conversion may have failed')
                        return latestValueStudy.results as any
                      })()}
                      onSave={async (results) => {
                        try {
                          // Upload processed image to Convex Storage
                          toast.loading('Uploading image...', { id: 'upload-image' })
                          const storageId = await uploadDataUrlToStorage(
                            results.processedImageDataUrl,
                            `value-study-${latestValueStudy._id}-${Date.now()}.png`
                          )
                          toast.dismiss('upload-image')
                          
                          // Format results with storage ID instead of data URL
                          const formattedResults: any = {
                            processedImageStorageId: storageId,
                            metadata: {
                              width: Number(results.metadata.width),
                              height: Number(results.metadata.height),
                              diagonal: Number(results.metadata.diagonal),
                              originalFormat: String(results.metadata.originalFormat)
                            },
                            parameters: {
                              levels: Number(results.parameters.levels),
                              smoothness: Number(results.parameters.smoothness)
                            }
                          }
                          
                          // Only include optional fields if they're defined
                          if (results.parameters.useMedianBlur !== undefined) {
                            formattedResults.parameters.useMedianBlur = Boolean(results.parameters.useMedianBlur)
                          }
                          if (results.parameters.meanCurvaturePasses !== undefined) {
                            formattedResults.parameters.meanCurvaturePasses = Number(results.parameters.meanCurvaturePasses)
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
                          toast.dismiss('upload-image')
                          console.error('Save error:', error)
                          toast.error(error.message || 'Failed to save Value Study settings')
                        }
                      }}
                    />
                  )
                ) : processingValueStudy ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Processing Value Study...</p>
                  </div>
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
                          
                          // Upload processed image to storage
                          toast.loading('Uploading image...', { id: 'upload-inline' })
                          const storageId = await uploadDataUrlToStorage(
                            processingResult.processedImageDataUrl,
                            `value-study-${result.experimentId}-${Date.now()}.png`
                          )
                          toast.dismiss('upload-inline')
                          
                          // Format results with storage ID
                          const formattedResults = {
                            processedImageStorageId: storageId,
                            metadata: processingResult.metadata,
                            parameters: processingResult.parameters
                          }
                          
                          // Save results
                          const saveResponse = await updateValueStudyResults({
                            experimentId: result.experimentId as any,
                            results: formattedResults,
                            status: 'completed'
                          })
                          
                          if (saveResponse.success) {
                            toast.success('Value Study completed!')
                            // Ensure the panel is expanded to show results
                            setExpandedPanels(prev => ({ ...prev, valueStudy: true }))
                          } else {
                            toast.error(saveResponse.message || 'Failed to save Value Study results')
                          }
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
              className="card-header"
            >
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity flex-1"
                  onClick={() => togglePanel('edgeDetection')}
                >
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
                  <button
                    type="button"
                    onClick={() => togglePanel('edgeDetection')}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    aria-label={expandedPanels.edgeDetection ? 'Collapse panel' : 'Expand panel'}
                  >
                    {expandedPanels.edgeDetection ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            {expandedPanels.edgeDetection && (
              <div className="card-content">
                {latestEdgeDetection && imageUrl && latestEdgeDetection.results ? (
                  // Check if we have a storage ID that needs conversion but don't have converted data URL yet
                  (latestEdgeDetection.results.processedImageStorageId && 
                   !convertedResults.edgeDetection?.processedImageDataUrl && 
                   !latestEdgeDetection.results.processedImageDataUrl) ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">Loading Edge Detection results...</p>
                    </div>
                  ) : (
                    <EdgeDetectionResults
                      originalImageUrl={imageUrl}
                      initialResults={(() => {
                        // Prefer converted results if available (has data URL)
                        const converted = convertedResults.edgeDetection
                        if (converted && converted.processedImageDataUrl) {
                          return converted as any
                        }
                        // If we have raw results with data URL (old format), use them
                        if (latestEdgeDetection.results.processedImageDataUrl) {
                          return latestEdgeDetection.results as any
                        }
                        // If we have storage ID but no conversion yet, we should have shown loading above
                        // But if we get here, try to use the raw results (component might handle it)
                        console.warn('Edge Detection results have storage ID but no converted data URL - conversion may have failed')
                        return latestEdgeDetection.results as any
                      })()}
                    onSave={async (results) => {
                      try {
                        // Validate data URL
                        if (!results.processedImageDataUrl || typeof results.processedImageDataUrl !== 'string') {
                          throw new Error('Invalid processed image data URL')
                        }
                        
                        // Upload processed image to Convex Storage
                        toast.loading('Uploading image...', { id: 'upload-image' })
                        const storageId = await uploadDataUrlToStorage(
                          results.processedImageDataUrl,
                          `edge-detection-${latestEdgeDetection._id}-${Date.now()}.png`
                        )
                        toast.dismiss('upload-image')
                        
                        // Format results with storage ID instead of data URL
                        const formattedResults: any = {
                          processedImageStorageId: storageId,
                          metadata: {
                            width: Number(results.metadata.width),
                            height: Number(results.metadata.height),
                            diagonal: Number(results.metadata.diagonal),
                            originalFormat: String(results.metadata.originalFormat)
                          },
                          parameters: {
                            blurRadius: Number(results.parameters.blurRadius),
                            threshold: Number(results.parameters.threshold)
                          }
                        }
                        
                        // Only include invert if it's explicitly set (optional field)
                        if (results.parameters.invert !== undefined) {
                          formattedResults.parameters.invert = Boolean(results.parameters.invert)
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
                        toast.dismiss('upload-image')
                        console.error('Save error:', error)
                        toast.error(error.message || 'Failed to save Edge Detection settings')
                      }
                    }}
                  />
                  )
                ) : processingEdgeDetection ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Processing Edge Detection...</p>
                  </div>
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
                          
                          // Upload processed image to storage
                          toast.loading('Uploading image...', { id: 'upload-inline' })
                          const storageId = await uploadDataUrlToStorage(
                            processingResult.processedImageDataUrl,
                            `edge-detection-${result.experimentId}-${Date.now()}.png`
                          )
                          toast.dismiss('upload-inline')
                          
                          // Format results with storage ID
                          const formattedResults = {
                            processedImageStorageId: storageId,
                            metadata: processingResult.metadata,
                            parameters: processingResult.parameters
                          }
                          
                          // Save results
                          const saveResponse = await updateEdgeDetectionResults({
                            experimentId: result.experimentId as any,
                            results: formattedResults,
                            status: 'completed'
                          })
                          
                          if (saveResponse.success) {
                            toast.success('Edge Detection completed!')
                          } else {
                            toast.error(saveResponse.message || 'Failed to save Edge Detection results')
                          }
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


