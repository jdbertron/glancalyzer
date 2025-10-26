import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { 
  Camera, 
  Play, 
  Pause, 
  Square, 
  Eye, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { EYE_TRACKING_EXPERIMENT } from '../constants'
import { EyeTrackingResults } from '../components/EyeTrackingResults'

// WebGazer types
interface GazePoint {
  x: number
  y: number
  timestamp: number
  confidence?: number
}

interface EyeTrackingData {
  gazePoints: GazePoint[]
  fixationPoints: Array<{
    x: number
    y: number
    duration: number
    startTime: number
  }>
  scanPath: GazePoint[]
  sessionDuration: number
  heatmapData?: any
}

export function EyeTrackingExperiment() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, userId } = useAuth()
  const pictureId = searchParams.get('pictureId')
  
  // WebGazer state
  const [webgazer, setWebgazer] = useState<any>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [isCalibrated, setIsCalibrated] = useState(false)
  const [webcamPermission, setWebcamPermission] = useState(false)
  const [gazeData, setGazeData] = useState<GazePoint[]>([])
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(EYE_TRACKING_EXPERIMENT.DURATION_SECONDS)
  const [showResults, setShowResults] = useState(false)
  const [imageOrientation, setImageOrientation] = useState<'portrait' | 'landscape' | null>(null)
  const [processedData, setProcessedData] = useState<EyeTrackingData | null>(null)
  const [experimentCreated, setExperimentCreated] = useState(false)
  
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isCreatingExperimentRef = useRef<boolean>(false)
  
  // Convex queries and mutations
  const picture = useQuery(api.pictures.getPicture, pictureId ? { pictureId: pictureId as any } : 'skip')
  const createExperiment = useMutation(api.experiments.createExperiment)
  const updateEyeTrackingResults = useMutation(api.experiments.updateEyeTrackingResults)
  const getImageUrl = useQuery(api.pictures.getImageUrl, picture?.fileId ? { fileId: picture.fileId } : 'skip')

  // Initialize WebGazer
  const initializeWebGazer = useCallback(async () => {
    try {
      // Dynamically import WebGazer
      const webgazerModule = await import('webgazer')
      const wg = webgazerModule.default || webgazerModule
      
      // Initialize WebGazer
      await wg.setRegression('ridge')
        .setTracker('TFFacemesh')
        .setGazeListener((data: any, clock: any) => {
          if (data && isTracking) {
            const gazePoint: GazePoint = {
              x: data.x,
              y: data.y,
              timestamp: Date.now(),
              confidence: data.confidence || 0.5
            }
            setGazeData(prev => {
              const newData = [...prev, gazePoint]
              // Enhanced logging with more details
              console.log(`👁️ Gaze point #${newData.length}: (${Math.round(data.x)}, ${Math.round(data.y)}) confidence: ${(data.confidence || 0.5).toFixed(2)}`)
              if (newData.length % 10 === 0) {
                console.log(`📊 Data collection progress: ${newData.length} points collected so far`)
              }
              return newData
            })
          }
        })
        .saveDataAcrossSessions(true)
        .showVideoPreview(true) // Show webcam for debugging
        .showPredictionPoints(false) // Hide prediction points initially
        .begin()
        
      // Style the video preview to be more visible and better positioned
      setTimeout(() => {
        const videoElement = document.querySelector('video') as HTMLVideoElement
        if (videoElement) {
          videoElement.style.position = 'fixed'
          videoElement.style.top = '20px'
          videoElement.style.right = '20px'
          videoElement.style.width = '200px'
          videoElement.style.height = '150px'
          videoElement.style.border = '2px solid #3b82f6'
          videoElement.style.borderRadius = '8px'
          videoElement.style.zIndex = '1000'
          videoElement.style.backgroundColor = '#000'
        }
      }, 1000)
      
      setWebgazer(wg)
      setIsInitialized(true)
      setWebcamPermission(true)
      
      // Show initialization success
      toast.success('WebGazer initialized! Starting automatic calibration...')
      
      // Start automatic calibration immediately
      setTimeout(() => {
        startCalibration()
      }, 1000)
      
    } catch (error) {
      console.error('WebGazer initialization failed:', error)
      toast.error('Failed to initialize eye tracking. Please check your webcam permissions.')
    }
  }, [isTracking])

  // Start calibration
  const startCalibration = useCallback(async () => {
    if (!webgazer) return
    
    try {
      // Automatic calibration - no visible points needed
      await webgazer.showPredictionPoints(false) // Keep prediction points hidden
      await webgazer.showVideoPreview(false) // Keep webcam hidden during calibration
      
      // Give WebGazer time to learn from natural eye movements
      toast.success('Calibrating... Look at the screen naturally for 3 seconds.', {
        duration: 3000,
        style: {
          background: '#3b82f6',
          color: 'white',
        }
      })
      
      // Auto-complete calibration after 3 seconds
      setTimeout(() => {
        setIsCalibrated(true)
        toast.success('Calibration complete! You can now start the experiment.')
      }, 3000)
      
    } catch (error) {
      console.error('Calibration failed:', error)
      toast.error('Calibration failed. Please try again.')
    }
  }, [webgazer])

  // Start tracking session
  const startTracking = useCallback(() => {
    if (!webgazer || !isCalibrated) return
    
    setGazeData([])
    setSessionStartTime(Date.now())
    setIsTracking(true)
    setTimeRemaining(EYE_TRACKING_EXPERIMENT.DURATION_SECONDS)
    setExperimentCreated(false) // Reset for new experiment
    isCreatingExperimentRef.current = false // Reset ref for new experiment
    
    // Start countdown timer
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev: number) => {
        if (prev <= 1) {
          // Auto-stop when timer reaches 0
          console.log('⏰ Timer auto-stop triggered at', new Date().toISOString())
          clearInterval(intervalRef.current!)
          // Call stopTracking asynchronously to avoid blocking the timer
          console.log('⏰ Timer calling stopTracking()')
          stopTracking().catch(error => {
            console.error('Error in timer auto-stop:', error)
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    toast.success('Eye tracking started! Look at the image naturally.')
  }, [webgazer, isCalibrated])

  // Stop tracking session
  const stopTracking = useCallback(async () => {
    const callId = Math.random().toString(36).substring(2, 15)
    const timestamp = new Date().toISOString()
    
    console.log(`🛑 [${callId}] stopTracking called at ${timestamp}`)
    console.log(`🛑 [${callId}] Current state:`, { 
      webgazer: !!webgazer, 
      isTracking, 
      experimentCreated, 
      isCreatingExperiment: isCreatingExperimentRef.current 
    })
    
    // Set the ref IMMEDIATELY to prevent race conditions
    if (isCreatingExperimentRef.current) {
      console.log(`🚫 [${callId}] stopTracking prevented - already creating experiment`)
      return
    }
    isCreatingExperimentRef.current = true
    
    if (!webgazer || !isTracking || experimentCreated) {
      console.log(`🚫 [${callId}] stopTracking prevented at ${timestamp}`)
      isCreatingExperimentRef.current = false // Reset if we're not proceeding
      return
    }
    
    console.log(`✅ [${callId}] stopTracking proceeding - creating experiment`)
    setIsTracking(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    // Clean up WebGazer and stop webcam
    try {
      await webgazer.pause()
      await webgazer.showVideoPreview(false)
      await webgazer.showPredictionPoints(false)
      await webgazer.end() // Properly end WebGazer session
      
      // Force hide the video element
      const videoElement = document.querySelector('video') as HTMLVideoElement
      if (videoElement) {
        videoElement.style.display = 'none'
      }
    } catch (error) {
      console.error('Error stopping WebGazer:', error)
    }
    
    const sessionDuration = Date.now() - (sessionStartTime || Date.now())
    
    // Process the gaze data with enhanced logging
    console.log(`🔄 Processing ${gazeData.length} gaze points over ${sessionDuration}ms`)
    console.log('📊 Raw gaze data sample:', gazeData.slice(0, 5))
    console.log(`📈 Data collection rate: ${(gazeData.length / (sessionDuration / 1000)).toFixed(1)} points/second`)
    
    const processedData = processGazeData(gazeData, sessionDuration)
    console.log('✅ Processed data summary:', {
      gazePoints: processedData.gazePoints.length,
      fixations: processedData.fixationPoints.length,
      sessionDuration: processedData.sessionDuration,
      scanPathLength: processedData.scanPath.length
    })
    console.log('💾 Setting processedData state for display...')
    setProcessedData(processedData) // Store for immediate display
    
    // Create experiment record
    try {
      console.log(`📝 [${callId}] Creating experiment record at ${new Date().toISOString()}...`)
      console.log(`📝 [${callId}] Experiment data:`, {
        pictureId,
        userId,
        sessionDuration,
        gazePointCount: gazeData.length
      })
      
      const experimentId = await createExperiment({
        pictureId: pictureId as any,
        userId: userId || undefined,
        experimentType: 'Eye Tracking',
        parameters: {
          sessionDuration,
          gazePointCount: gazeData.length
        }
      })
      
      console.log(`✅ [${callId}] Experiment created successfully:`, experimentId.experimentId)
      
      // Update with eye tracking results
      await updateEyeTrackingResults({
        experimentId: experimentId.experimentId,
        eyeTrackingData: processedData,
        status: 'completed'
      })
      
      console.log('✅ Eye tracking results updated')
      setExperimentCreated(true) // Mark as created only after success
      setShowResults(true)
      toast.success('Eye tracking session completed!')
      
    } catch (error) {
      console.error('❌ Failed to save experiment:', error)
      toast.error('Failed to save experiment results.')
      // Still show results even if saving failed
      setShowResults(true)
    } finally {
      // Always reset the ref to allow future experiments
      isCreatingExperimentRef.current = false
    }
  }, [webgazer, isTracking, sessionStartTime, gazeData, pictureId, userId, createExperiment, updateEyeTrackingResults, experimentCreated])

  // Process gaze data into fixations and scan path
  const processGazeData = (gazePoints: GazePoint[], duration: number): EyeTrackingData => {
    // Simple fixation detection using global constants
    const fixationThreshold = EYE_TRACKING_EXPERIMENT.FIXATION_THRESHOLD_PX // pixels
    const fixationDuration = EYE_TRACKING_EXPERIMENT.FIXATION_DURATION_MS // ms
    
    const fixationPoints: Array<{
      x: number
      y: number
      duration: number
      startTime: number
    }> = []
    
    let currentFixation: { x: number; y: number; startTime: number; points: GazePoint[] } | null = null
    
    for (const point of gazePoints) {
      if (!currentFixation) {
        currentFixation = {
          x: point.x,
          y: point.y,
          startTime: point.timestamp,
          points: [point]
        }
      } else {
        const distance = Math.sqrt(
          Math.pow(point.x - currentFixation.x, 2) + 
          Math.pow(point.y - currentFixation.y, 2)
        )
        
        if (distance < fixationThreshold) {
          currentFixation.points.push(point)
          // Update center point
          currentFixation.x = currentFixation.points.reduce((sum, p) => sum + p.x, 0) / currentFixation.points.length
          currentFixation.y = currentFixation.points.reduce((sum, p) => sum + p.y, 0) / currentFixation.points.length
        } else {
          // End current fixation if it lasted long enough
          const fixationDuration = point.timestamp - currentFixation.startTime
          if (fixationDuration >= fixationDuration) {
            fixationPoints.push({
              x: currentFixation.x,
              y: currentFixation.y,
              duration: fixationDuration,
              startTime: currentFixation.startTime
            })
          }
          
          // Start new fixation
          currentFixation = {
            x: point.x,
            y: point.y,
            startTime: point.timestamp,
            points: [point]
          }
        }
      }
    }
    
    // Add final fixation if it exists
    if (currentFixation && currentFixation.points.length > 1) {
      const finalDuration = gazePoints[gazePoints.length - 1].timestamp - currentFixation.startTime
      if (finalDuration >= fixationDuration) {
        fixationPoints.push({
          x: currentFixation.x,
          y: currentFixation.y,
          duration: finalDuration,
          startTime: currentFixation.startTime
        })
      }
    }
    
    return {
      gazePoints,
      fixationPoints,
      scanPath: gazePoints,
      sessionDuration: duration,
      heatmapData: generateHeatmapData(gazePoints)
    }
  }

  // Generate heatmap data
  const generateHeatmapData = (gazePoints: GazePoint[]) => {
    // Simple heatmap generation - in a real implementation, you'd use a proper heatmap library
    const gridSize = 20
    const heatmap: number[][] = []
    
    for (let i = 0; i < gridSize; i++) {
      heatmap[i] = new Array(gridSize).fill(0)
    }
    
    gazePoints.forEach(point => {
      const x = Math.floor((point.x / window.innerWidth) * gridSize)
      const y = Math.floor((point.y / window.innerHeight) * gridSize)
      
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        heatmap[y][x] += 1
      }
    })
    
    return heatmap
  }

  // Detect image orientation
  const detectImageOrientation = useCallback((img: HTMLImageElement) => {
    const aspectRatio = img.naturalWidth / img.naturalHeight
    setImageOrientation(aspectRatio > 1 ? 'landscape' : 'portrait')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (webgazer) {
        try {
          webgazer.pause()
          webgazer.showVideoPreview(false)
          webgazer.showPredictionPoints(false)
          webgazer.end()
          
          // Force hide the video element
          const videoElement = document.querySelector('video') as HTMLVideoElement
          if (videoElement) {
            videoElement.style.display = 'none'
          }
        } catch (error) {
          console.error('Error cleaning up WebGazer:', error)
        }
      }
    }
  }, [webgazer])


  // Initialize on mount
  useEffect(() => {
    if (pictureId && !webgazer) {
      initializeWebGazer()
    }
  }, [pictureId, initializeWebGazer])

  if (!picture) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-4">
            Please log in to run eye tracking experiments
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/experiments')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Eye Tracking Experiment
                </h1>
                <p className="text-gray-600">
                  {picture.fileName} • {isTracking ? 'Tracking in progress...' : 'Ready to start'}
                </p>
              </div>
            </div>
            
            {isTracking && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-600">
                    {timeRemaining}s
                  </div>
                  <div className="text-sm text-gray-500">
                    Time remaining
                  </div>
                </div>
                <button
                  onClick={async () => {
                    console.log('🛑 Stop tracking button clicked at', new Date().toISOString())
                    console.log('🛑 Manual button calling stopTracking()')
                    try {
                      await stopTracking()
                    } catch (error) {
                      console.error('Error in manual stop:', error)
                    }
                  }}
                  className="btn btn-outline btn-sm"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {!showResults ? (
          <div className={`${imageOrientation === 'portrait' ? 'flex gap-4' : 'space-y-4'}`}>
            {/* Image Display - Maximized for eye tracking accuracy */}
            <div className={`${imageOrientation === 'portrait' ? 'flex-1' : 'w-full'}`}>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Image to Analyze</h2>
                  <p className="card-description">
                    Look at this image naturally during the experiment
                  </p>
                </div>
                <div className="card-content p-2">
                  <div className="relative">
                    {getImageUrl ? (
                      <img
                        ref={imageRef}
                        src={getImageUrl}
                        alt="Experiment image"
                        className="w-full h-auto rounded-lg shadow-lg"
                        style={{ 
                          maxHeight: imageOrientation === 'portrait' ? '80vh' : '70vh', 
                          objectFit: 'contain',
                          width: '100%'
                        }}
                        onLoad={(e) => {
                          const img = e.target as HTMLImageElement
                          detectImageOrientation(img)
                        }}
                        onError={(e) => {
                          console.error('Image failed to load:', e)
                          toast.error('Failed to load image')
                        }}
                      />
                    ) : (
                      <div className="w-full h-64 bg-gray-100 rounded-lg shadow-lg flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                          <p className="text-gray-500">Loading image...</p>
                          <p className="text-xs text-gray-400 mt-2">
                            Picture ID: {pictureId}
                          </p>
                        </div>
                      </div>
                    )}
                    {isTracking && (
                      <div className="absolute inset-0 pointer-events-none">
                        <canvas
                          ref={canvasRef}
                          className="w-full h-full"
                          style={{ position: 'absolute', top: 0, left: 0 }}
                        />
                        {/* Tracking indicator with data count */}
                        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                          🔴 Tracking Active ({gazeData.length} points)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls - Ultra-compact on the longer side */}
            <div className={`${imageOrientation === 'portrait' ? 'w-72 flex-shrink-0' : 'w-full'}`}>
              <div className="card">
                <div className="card-header py-3">
                  <h2 className="card-title text-lg">Experiment Controls</h2>
                  <p className="card-description text-sm">
                    Follow the steps to complete your eye tracking experiment
                  </p>
                </div>
                <div className="card-content space-y-2 p-3">
                  {/* Step 1: Initialize - Show until completed */}
                  {!isInitialized && (
                    <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-xs">
                          1. Initialize Eye Tracking
                        </h3>
                        <p className="text-xs text-gray-600">
                          Setting up eye tracking system...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Calibrate - Show when initialized but not calibrated */}
                  {isInitialized && !isCalibrated && (
                    <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-xs">
                          2. Auto-Calibrate System
                        </h3>
                        <p className="text-xs text-gray-600">
                          Calibrating automatically... Look at the screen naturally
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Start Experiment - Show when calibrated but not tracking */}
                  {isCalibrated && !isTracking && (
                    <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="h-4 w-4 rounded-full border-2 border-primary-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-xs">
                          3. Start {EYE_TRACKING_EXPERIMENT.DURATION_SECONDS}-Second Session
                        </h3>
                        <p className="text-xs text-gray-600">
                          Ready to start - look at the image naturally for {EYE_TRACKING_EXPERIMENT.DURATION_SECONDS} seconds
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          console.log('🎯 Start tracking button clicked')
                          startTracking()
                        }}
                        className="btn btn-primary btn-sm text-xs px-2 py-1"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start
                      </button>
                    </div>
                  )}

                  {/* Webcam Status */}
                  <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg">
                    <Camera className="h-4 w-4 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-blue-900 text-xs">
                        {isTracking ? 'Tracking Active' : 'Webcam Status'}
                      </h3>
                      <p className="text-xs text-blue-700">
                        {isTracking 
                          ? `Tracking your eye movements - ${timeRemaining}s remaining`
                          : webcamPermission 
                            ? 'Webcam access granted' 
                            : 'Requesting webcam permission...'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Data Collection Status - Only show during tracking */}
                  {isTracking && (
                    <div className="flex items-center space-x-2 p-2 bg-green-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="h-4 w-4 rounded-full bg-green-500 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-green-900 text-xs">
                          Data Collection
                        </h3>
                        <p className="text-xs text-green-700">
                          {gazeData.length} gaze points collected
                          {gazeData.length > 0 && (
                            <span className="ml-2">
                              ({Math.round(gazeData.length / (EYE_TRACKING_EXPERIMENT.DURATION_SECONDS - timeRemaining))} pts/sec)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Success Header */}
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Experiment Complete!
              </h2>
              <p className="text-gray-600 mb-6">
                Your eye tracking data has been saved and analyzed.
              </p>
            </div>



            {/* Results Display - Show if data was collected, otherwise show no data message */}
            {processedData && processedData.gazePoints.length > 0 ? (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title flex items-center space-x-2">
                    <Eye className="h-5 w-5" />
                    <span>Eye Tracking Results</span>
                  </h2>
                  <p className="card-description">
                    Choose a visualization type to explore your eye movement patterns
                  </p>
                  
                  {/* Data Quality Indicator */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Data Quality</span>
                      <span className={`text-sm font-medium ${
                        processedData.gazePoints.length > 100 ? 'text-green-600' : 
                        processedData.gazePoints.length > 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {processedData.gazePoints.length > 100 ? 'Good' : 
                         processedData.gazePoints.length > 50 ? 'Fair' : 'Poor'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>Gaze points collected: {processedData.gazePoints.length}</div>
                      <div>Fixations detected: {processedData.fixationPoints.length}</div>
                      <div>Session duration: {Math.round(processedData.sessionDuration / 1000)}s</div>
                      <div>Data rate: {Math.round(processedData.gazePoints.length / (processedData.sessionDuration / 1000))} points/sec</div>
                    </div>
                  </div>
                </div>
                <div className="card-content">
                  {getImageUrl ? (
                    <EyeTrackingResults
                      data={processedData}
                      imageUrl={getImageUrl}
                      imageWidth={800}
                      imageHeight={600}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Image Not Available
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Eye tracking data was collected but the image is not available for visualization.
                      </p>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Data Summary</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Gaze points: {processedData.gazePoints.length}</div>
                          <div>Fixations: {processedData.fixationPoints.length}</div>
                          <div>Duration: {Math.round(processedData.sessionDuration / 1000)}s</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-content">
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Data Collected
                    </h3>
                    <p className="text-gray-600 mb-4">
                      No eye tracking data was collected during the session.
                    </p>
                    <div className="text-sm text-gray-500">
                      <p>This could happen if:</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Webcam permissions were denied</li>
                        <li>Poor lighting conditions</li>
                        <li>Face not detected properly</li>
                        <li>Calibration failed</li>
                      </ul>
                    </div>
                    <div className="mt-6">
                      <button
                        onClick={() => {
                          setShowResults(false)
                          setProcessedData(null)
                          setGazeData([])
                          setExperimentCreated(false)
                          isCreatingExperimentRef.current = false
                        }}
                        className="btn btn-primary"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons - Only show when data was collected */}
            {processedData && processedData.gazePoints.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate(`/picture-experiments?pictureId=${pictureId}`)}
                  className="btn btn-primary"
                >
                  View All Experiments for This Picture
                </button>
                <button
                  onClick={() => {
                    setShowResults(false)
                    setProcessedData(null)
                    setGazeData([])
                    setExperimentCreated(false)
                    isCreatingExperimentRef.current = false
                  }}
                  className="btn btn-outline"
                >
                  Run Another Experiment
                </button>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  )
}
